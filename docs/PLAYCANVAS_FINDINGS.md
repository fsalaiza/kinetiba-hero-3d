# PlayCanvas para Kineti

Versión evaluada: `playcanvas@2.22.0`, fijada en el proyecto. Fixture: `research/playcanvas.html`; implementación: `src/kineti/research/playcanvasScene.js`. La autoría de la geometría reutiliza los módulos del proyecto que emplean Three; la cámara, materiales, mallas, luces, instancias, posprocesado, GPU y bucle de render pertenecen a PlayCanvas.

## Alcance y contrato

El cubo contiene 27 piezas de 0.86, radio 0.075, centros separados 0.96 y 54 glifos de 0.43 en las caras exteriores. Se conserva explícitamente Euler XYZ mediante cuaternión, escala 1.08, posición inicial `(1.7, 0.1, 0)`, FOV vertical de 37° y la misma distancia de cámara. El mosaico tiene 24 × 18 o 9 × 18 baldosas, dividido en seis familias de glifos y doce lotes de instancias. DPR se fija a 1.

La API expone `setControls`, `getControls`, `setProgress`, `getProbeState`, `getDiagnostics`, `runComputeProbe`, `probeNativeShaders`, el adaptador común `runRawControlProbe` y `dispose`. `?renderer=webgl` o `?backend=webgl2` fuerza WebGL2; por defecto se intenta WebGPU y el dispositivo informa qué backend se seleccionó realmente. Ese orden y la alternativa WebGL2 están soportados por [`createGraphicsDevice`](https://api.playcanvas.com/engine/functions/createGraphicsDevice.html).

## Control implementado

| Necesidad de Kineti | Implementación concreta | Matiz |
| --- | --- | --- |
| Pieza individual, explosión, rotación absoluta y cámara | Entidades y transformaciones locales, cuaternión XYZ y `camera.fov` | No requiere editor ni servicio alojado. |
| Rugosidad, metalicidad y capa transparente | `StandardMaterial`: `gloss = 1 − roughness`, `metalness`, `clearCoat` | El modelo de material y las unidades de luz no producen píxeles idénticos a otros motores. |
| HDR e intensidad del entorno | Mismo `.hdr`, `EnvLighting.generateLightingSource` y `generateAtlas`, `scene.skyboxIntensity` | HDR se informa cargado solo después de generar el atlas; no se sustituye silenciosamente por un color. |
| Intensidad de luz, exposición y color del glifo | Luz direccional, `scene.exposure`, material del glifo | La iluminación ambiente nativa sustituye a `HemisphereLight`; no es una equivalencia fotométrica. |
| Sombras | PCF de 1024, piezas/glifos proyectan y reciben; suelo opcional | La matriz modificada por el shader también forma parte de la variante de sombras. |
| Onda en GPU | Override de `transformInstancingVS` en GLSL y WGSL | `z += sin(centerX*1.3 + centerY*.7 − phase)*amplitude`; cambia dos uniformes, no la matriz ni sus buffers. |
| Glifo unido a su baldosa | Los mismos centros y la misma función de desplazamiento | El relieve ya está incorporado en la geometría de cada glifo. |
| Densidad 432/162 | Reconstrucción de buffers estáticos al cambiar densidad o viewport | `instanceMatrixVersion` aumenta solo al reconstruir; cambiar amplitud/fase lo conserva. |
| Posprocesado propio | Fuentes completas GLSL/WGSL de vertex y fragment; RGB separado y contraste | `PostEffect` toma la textura de la escena; se añade o retira de la cola de cámara. |
| Cómputo y lectura GPU | WGSL, `Compute`, `StorageBuffer`, 64 valores esperados `i*3+7` | WebGPU. En WebGL2 devuelve una limitación explícita; no calcula esos valores por CPU. |
| Shader propio y MRT | Un quad con vertex/fragment propios escribe dos attachments RGBA8; se leen las dos texturas | Es una sonda separada de la estética de Kineti y de la escena normal. |

La documentación de [instancing](https://developer.playcanvas.com/user-manual/graphics/advanced-rendering/hardware-instancing/) confirma que el shader puede interpretar el formato de instancia mediante `getModelMatrix`. La documentación de [shaders](https://developer.playcanvas.com/user-manual/graphics/shaders/) y el [preprocesador](https://developer.playcanvas.com/user-manual/graphics/shaders/preprocessor/) describen el acceso a fuentes, chunks, defines y uniforms. En este prototipo hay fuentes WGSL explícitas, por lo que WebGPU no necesita bajar glslang/twgsl.

La sonda de [compute](https://developer.playcanvas.com/user-manual/graphics/shaders/compute-shaders/) se agenda durante `app.update`, como requiere el ciclo de comandos del motor, y compara una lectura real del buffer contra el resultado esperado. WebGL2 dispone de [transform feedback](https://developer.playcanvas.com/user-manual/graphics/advanced-rendering/transform-feedback/), una API distinta que esta sonda no ejecuta. Su ausencia del probe no demuestra incapacidad para simulaciones por vértice en WebGL2.

El efecto de pantalla usa [`PostEffect`](https://api.playcanvas.com/engine/classes/PostEffect.html), aún soportado. Para una producción con HDR intermedio, TAA, múltiples etapas o composición avanzada, PlayCanvas también documenta [`CameraFrame` y pases propios](https://developer.playcanvas.com/user-manual/graphics/posteffects/). No se atribuyen al fixture efectos que no implementa.

## Evidencia de ejecución

Preflight realizado con Chrome instalado, Puppeteer headless, Windows, 1440 × 900 y DPR 1. Evidencia: [`report.json`](QA/playcanvas-preflight-final/report.json), capturas [`WebGPU mosaico`](QA/playcanvas-preflight-final/webgpu-wave.png), [`WebGL2 mosaico`](QA/playcanvas-preflight-final/webgl-wave.png), [`WebGPU post y sombras`](QA/playcanvas-preflight-final/webgpu-post-shadows.png) y [`WebGL2 post y sombras`](QA/playcanvas-preflight-final/webgl-post-shadows.png).

| Prueba ejecutada | WebGPU | WebGL2 |
| --- | --- | --- |
| Cubo visible, 27 piezas y 54 glifos; HDR 1024 × 512 convertido a atlas 512 × 512 | Pasa | Pasa |
| Mosaico y onda en el shader | Pasa | Pasa |
| Efecto RGB/contraste y sombras activados | Pasa | Pasa |
| Draw calls observadas del cubo / mosaico, sin post ni sombras | 81 / 12 | 81 / 12 |
| Triángulos enviados del cubo / mosaico | 128,244 / 1,099,776 | 128,244 / 1,099,776 |
| Compute: lectura de los 64 valores `7, 10, …, 196` | Pasa | Límite explícito de compute nativo |
| Vertex y fragment propios, dos attachments RGBA8 de 4 × 4, lectura de todos sus píxeles | Pasa | Pasa |
| Errores de render en la ejecución corregida | 0 | 0 |

La lectura MRT obtuvo `[64,127,191,255]` en el primer attachment y `[191,64,127,255]` en el segundo, en los dieciséis píxeles de cada uno. Se admite ±1 al cuantizar los valores de shader `[.25,.5,.75,1]`; no se usan valores fabricados por CPU como resultado de la GPU.

La prueba de extremos de clearcoat encontró un problema concreto en la implementación inicial. El setter genérico de floats de `StandardMaterial` en 2.22 trata 0 y 1 como la misma clase de extremos, pero clearcoat cambia la estructura del shader en cero. El fixture ahora usa el método público `clearVariants()` cuando se activa o desactiva clearcoat. La repetición posterior produjo diferencia media de píxeles de 0.2293 en WebGPU y 0.2256 en WebGL2, con cero errores: [`clearcoat-endpoint.json`](QA/playcanvas-preflight-final/clearcoat-endpoint.json). Ese resultado sustituye el fallo de clearcoat conservado en el reporte previo.

El QA común posterior pasa **19/19 comprobaciones en WebGPU y 19/19 en WebGL2**, con cero errores en ambas rutas: [reporte de controles](QA/controls-2026-09-05T04-04-46-301Z/report.json) y [resumen de las ocho rutas](QA/control-summary.json). Incluye los controles compartidos y la sonda MRT; conserva como límite explícito el compute nativo en WebGL2. La ejecución dentro del laboratorio compilado también pasa conservación de controles, ambas sondas, cambios de renderer y disposición de escenas: [QA del laboratorio](QA/lab-2026-09-05T04-33-05-363Z/report.json).

Los tiempos entre frames observados no son un benchmark de GPU: la sesión de escritorio remoto condiciona la cadencia. Las cifras de draw calls proceden de llamadas efectivas a `device.draw`, incluyendo las instancias; tampoco prueban superioridad de rendimiento entre motores.

## Valoración independiente

El prototipo ejecutado muestra un camino práctico para conservar acceso por pieza, material y vértice dentro de un renderer PBR completo. PlayCanvas no obliga a usar su editor: el fixture funciona mediante su paquete JavaScript. La superficie de control relevante para Kineti incluye shader completo, extensiones del material, buffers de instancia y targets múltiples; una comparación que lo reduzca a herramienta visual omitiría ese acceso.

El coste visible en este prototipo es mantener dos fuentes de shader para soporte nativo WebGPU/WebGL2 y conocer los puntos de extensión del motor. Los [cambios de chunks entre versiones](https://developer.playcanvas.com/user-manual/graphics/shaders/migrations/) merecen pinning y una verificación al actualizar. Son costes de mantenimiento concretos, no un techo de calidad visual. La recomendación final depende de los probes ejecutados y del flujo de trabajo que se quiera para Kineti; no se decide por el número de funciones del catálogo ni por el renderer que ya tenía el repositorio.
