# Regresión de transformaciones en Three r185

El glifo que aparecía flotando en la web de Kineti conservaba **una transformación de una pose anterior en su uniform buffer**, aunque `Object3D.matrixWorld` fuera correcto. La causa se reprodujo y trazó en el código local de **Three 0.185.1**, dentro de `NodeMaterialObserver`. Una asignación mediante la API pública de materiales evita esa ruta de caché y conserva la geometría:

```js
import { positionLocal } from 'three/tsl';

material.positionNode = positionLocal;
```

La copia de diagnóstico, con este cambio, produjo **cero píxeles diferentes** al comparar la llegada directa al estado final con la secuencia que antes fallaba, en WebGPU y WebGL2. Una lectura real del UBO en WebGPU confirmó la matriz anterior antes del cambio y la matriz correcta después. La implementación de producción incorpora la asignación en [premiumMaterials.js](../src/kineti/premiumMaterials.js); la validación completa de la web original se realiza por separado.

## Reproducción observada

Entorno del experimento: Chrome instalado en Windows, Puppeteer headless, viewport de **390 × 844**, DPR 1, geometrías y materiales premium de Kineti. La copia inicial de `createExperience.js` tenía SHA-256 `e88134c3b1c7d076d60d66bae9523b69822ca8a226e6625d81d6d7d775b04752`, también guardado como `sourceHash` en los JSON de ejecución. Los experimentos se encuentran en [ghost-debug.html](../research/ghost-debug.html) y [ghostDebugScene.js](../src/kineti/research/ghostDebugScene.js).

La secuencia decisiva es **1 → 0 → 0.23 → 1**: primero se captura el estado final directo y luego se vuelve a él después de abrir el conjunto. En esta implementación, varios objetos regresan a la misma matriz mundial en 0 y 1, mientras cambian la visibilidad de los glifos frontales y el monograma. El conjunto de dibujos que participa en cada pase puede cambiar.

La primera exploración pasó también por 0.4, 0.56 y 0.74. Ese recorrido por el campo de piezas eliminaba el síntoma y devolvía imágenes iguales. **Ese resultado inicial no descartaba el error**: cambiaba la historia que debía reproducir. El fallo volvió al usar la secuencia exacta, tanto con los símbolos antiguos como con los nuevos.

La evidencia del error con los glifos nuevos está en [captura directa](QA/ghost-debug/exact-new-direct.png) y [captura secuencial](QA/ghost-debug/exact-new-sequential.png). El objeto identificado es `premium-glyph-6-0--1`; su posición equivocada aparece en la zona del monograma.

## Causa en el código local

El camino relevante es:

1. [`Renderer._renderObjectDirect`](../node_modules/three/src/renderers/common/Renderer.js) consulta `this._nodes.needsRefresh(renderObject)` antes de actualizar nodos y bindings.
2. [`NodeMaterialObserver.needsRefresh`](../node_modules/three/src/materials/nodes/manager/NodeMaterialObserver.js), alrededor de la línea 717, devuelve `true` cuando cambia su `renderId`.
3. Esa salida anticipada **no actualiza `renderObjectData.worldMatrix`**. La copia de la matriz se actualiza dentro de `equals()`, alrededor de la línea 382, que no se ejecuta por esa rama.
4. En 0.23 se actualiza el UBO con la pose abierta, pero el observador conserva la matriz de la pose anterior.
5. Al volver a 1, el objeto ya no pasa por la misma salida anticipada. `equals()` ve que la matriz actual coincide con la matriz antigua almacenada y permite omitir el refresco. El UBO conserva la transformación de 0.23.

No se trata de una deducción basada solo en una captura. La [traza del observador](QA/ghost-debug/cache-trace.json) registra el estado antes y después de llamar a la función real:

| Estado | `needsRefresh` | Traducción que conserva el observador | Traducción real de `matrixWorld` |
| --- | --- | --- | --- |
| Final directo, 1 | `false` | `[-1.277268, -0.858250, 0.136945]` | `[-1.277268, -0.858250, 0.136945]` |
| Apertura, 0.23 | `true`, cambia `renderId` de 57 a 75 | **Sigue** `[-1.277268, -0.858250, 0.136945]` | `[0.118661, -1.358987, 1.474499]` |
| Regreso a 1 | `false` | `[-1.277268, -0.858250, 0.136945]` | `[-1.277268, -0.858250, 0.136945]` |

En el último estado, el grupo de uniformes del pase de color conservaba la segunda traducción, aunque `matrixWorld` tuviera la primera. En el ensayo con sombras, el UBO correspondiente al pase de sombra sí contenía la matriz correcta. El error también se reprodujo con sombras y AO desactivados, por lo que corregir la sombra no resolvía esta regresión.

## Matriz de escena, buffer CPU y memoria GPU

Se distinguieron tres observaciones para evitar confundir un dato de JavaScript con una lectura de la GPU:

- **Matriz de escena:** `object.matrixWorld` y la posición proyectada esperada.
- **UniformsGroup antes del draw:** el `Float32Array` CPU que Three prepara para el UBO, inspeccionado en una envoltura de `backend.draw`. La lectura inicial identificó `nodeUniform20`, desplazamiento de 36 floats, como la matriz que permanecía desactualizada. [Registros completos](QA/ghost-debug/exact-cases.json).
- **Contenido real de GPUBuffer:** exclusivamente en la copia, los buffers de uniformes se crean además con `COPY_SRC`. Después del render se copian a un buffer `MAP_READ` mediante `copyBufferToBuffer` y se leen con `mapAsync`. No se sustituyen los resultados por el cálculo esperado en CPU. [Lectura GPU definitiva](QA/ghost-debug/gpu-readback-regression.json).

| Variante WebGPU | Traducción leída de la memoria GPU | Traducción esperada de la escena |
| --- | --- | --- |
| Material anterior, secuencia que falla | `[0.11866064, -1.35898733, 1.47449899]` | `[-1.27726847, -0.85825020, 0.13694547]` |
| `positionNode = positionLocal` | `[-1.27726841, -0.85825020, 0.13694547]` | `[-1.27726847, -0.85825020, 0.13694547]` |

La diferencia residual de la segunda fila corresponde a la conversión de los valores de JavaScript a float32. La lectura confirma que el error estaba en el estado utilizado para dibujar, antes de interpretar el resultado como un fallo de hardware o de geometría.

El archivo anterior `gpu-readback.json` se obtuvo después de que el agente de producción incorporara el cambio en el módulo compartido de materiales: ambas variantes ya tenían el nodo explícito. Se conserva como historial, pero **no es el contraste antes/después**. La comparación válida es `gpu-readback-regression.json`, que restaura explícitamente el material anterior únicamente dentro de la copia de diagnóstico.

## Corrección mediante la API pública

[`NodeMaterial.positionNode`](https://threejs.org/docs/pages/NodeMaterial.html#positionNode) permite definir posiciones locales mediante nodos. Asignarle `positionLocal` mantiene la posición existente de cada vértice en estas mallas rígidas. En la versión auditada, la presencia de ese nodo hace que `NodeMaterialObserver.containsNode()` active `hasNode`; los dibujos actualizan sus nodos y bindings sin depender de la comparación defectuosa descrita arriba.

La asignación se realiza al crear los materiales premium. El campo conserva su propio `positionNode`, que lo sustituye con la animación de instancias. No se fusionaron placas y glifos como solución del error y no se cambió la coreografía para esconderlo.

**En producción no se modificaron los internals ni los archivos de Three.** El experimento que sustituye temporalmente `renderer._nodes.needsRefresh` por una función que siempre devuelve `true`, los hooks de `backend.draw` y el acceso a `GPUBuffer` viven solo en el módulo de diagnóstico. No se incorporó ese módulo a las entradas de `build:lab` ni al build de la web. No se envió un issue ni ningún mensaje externo.

## Resultados y límites de las pruebas

La [tabla JSON de resultados](QA/ghost-debug/final-summary.json) conserva los valores y los objetos con matrices incorrectas. Las diferencias de imagen se calculan sobre capturas PNG decodificadas; `meanAbs` es la diferencia absoluta media de los tres canales RGB en escala 0–255. El conteo considera cambiado un píxel cuando la suma de diferencias RGB supera 6; **meanAbs = 0** significa igualdad exacta en todos los canales RGB, sin depender de ese umbral.

| Ensayo con secuencia 1 → 0 → 0.23 → 1 | Diferencia media RGB | Píxeles cambiados | UBO de glifo incorrecto |
| --- | ---: | ---: | --- |
| Material anterior, glifos nuevos | 0.286714 | 2,912 | Sí |
| Material anterior, glifos antiguos | 0.293740 | 2,895 | Sí |
| Material anterior, sombras y AO desactivados | 0.240714 | 1,625 | Sí |
| Refresco forzado mediante método privado, solo diagnóstico | 0 | 0 | No |
| Nodo de posición identidad, API pública, WebGPU | **0** | **0** | **No** |
| Nodo de posición identidad, API pública, WebGL2 | **0** | **0** | **No** |

Capturas corregidas: [WebGPU](QA/ghost-debug/public-identity-webgpu-sequential.png) y [WebGL2](QA/ghost-debug/public-identity-webgl-sequential.png). Las poses CPU eran iguales antes y después del recorrido incluso en las variantes que fallaban; comparar únicamente `getPoseState()` habría pasado por alto el defecto.

También se ensayaron render directo, ausencia de ordenación y materiales básicos durante la exploración inicial. Como esos casos incluían el recorrido por el campo que restablecía el estado, no se usan para concluir que esas variantes resuelvan el error. Invalidar los materiales una vez al comienzo también produjo igualdad en un ensayo exacto; no se toma como garantía para todos los cambios futuros de visibilidad y orden. La asignación pública continua identifica y evita la condición de caché observada.

Los ensayos independientes cubren la reproducción móvil indicada y ambas APIs del renderer de Three. No constituyen una garantía universal para todos los tipos de materiales, instancias, cámaras o versiones. Tampoco son un benchmark de rendimiento. El cambio mantiene más activa la comprobación de uniformes por dibujo, algo que debe considerarse al medir la escena final; no se atribuye un coste numérico sin medirlo.

## Cómo repetir el contraste aislado

Abrir el [experimento en el servidor de desarrollo](http://127.0.0.1:5173/research/ghost-debug.html?regression=1&readGPU=1) con viewport 390 × 844 y DPR 1. `regression=1` retira el nodo identidad solo de los materiales de esta copia; la producción conserva la corrección. `readGPU=1` permite la lectura del buffer. Para la ruta WebGL2, añadir `renderer=webgl`; la lectura `GPUBuffer` corresponde exclusivamente a WebGPU.

Después de que exista `window.__GHOST__`, ejecutar desde la consola:

```js
for (const p of [1, 0, 0.23, 1]) {
  window.__GHOST__.debug.render({ p, capture: true });
  await new Promise(resolve => setTimeout(resolve, 700));
}
await window.__GHOST__.debug.readGPUUniform();
```

Para el contraste corregido, **recargar la página** y añadir `identityPositionNode: true` al argumento de `debug.render`. El visor pausa el bucle de animación de la copia y deja cada pose estable para inspección; las capturas y el probe miden render real de Three. La reproducción original mediante navegación de la web y el QA completo de escritorio/móvil son comprobaciones adicionales a cargo de la implementación principal.

Esta regresión demuestra por qué el control de transformaciones necesita verificarse tanto en CPU como en la imagen final y por qué el QA debe incluir llegadas directas, regresos y cambios de visibilidad. La corrección utiliza el acceso público al shader de posición sin abandonar el renderer PBR ni cambiar las piezas de Kineti.
