# WebGPU directo: prototipo Kineti

La ruta `/research/native-webgpu.html` renderiza la escena con `GPUDevice`, buffers, WGSL, layouts y command encoders propios. Three solo participa en la geometría compartida y la aritmética CPU de matrices/números; no se construye ningún renderer, material, escena o pipeline de Three.

El objetivo es medir control explícito sobre el renderizado de este objeto. Que una prueba funcione aquí no demuestra que Three, Babylon o PlayCanvas carezcan de esa capacidad.

## Escena y controles implementados

| Parte | Implementación |
| --- | --- |
| Cubo | 27 cubies redondeados de 0.86, radio 0.075, centros separados 0.96; 54 glifos exteriores reales de 0.43. Siete draws instanciados: cuerpo y seis familias. |
| Pose | Euler XYZ `[0.30,0.53,-0.045]`, posición `[1.7,0.1,0]`, escala 1.08. Transformación absoluta, expansión y desplazamiento Y de una pieza aislada. |
| Cámara | Perspectiva vertical 37°, altura de referencia 7.05, Z calculada desde esos valores; viewport de referencia 1440×900, DPR 1. |
| Mosaico | 432 o 162 baldosas, 18 filas, 24 o 9 columnas; familia `((i*7)%27)%6`; 12 draws, cuerpo y glifo separados. |
| Onda GPU | `sin(center.x*1.3+center.y*0.7-phase)*amplitude` en WGSL. El cuerpo, el glifo y la sombra usan el mismo centro y desplazamiento. Cambiar amplitud/fase solo escribe uniforms. |
| Material | GGX/Smith/Schlick propios, metalness, roughness, clearcoat con roughness 0.26; normales de la geometría y matriz inversa transpuesta por instancia. |
| Luces | Direccional cálida 3.8 desde `[-3,7,9]`, relleno 0.9 desde `[5,0.5,6]`, hemisférica 1.25; exposición y color de glifos modificables. |
| HDR | RGBE local 1024×512, decodificado por código propio. Radiancia RGBA16F, 11 niveles de roughness, filtrado GGX en compute WGSL con 128 muestras por texel. Difuso con nueve armónicos esféricos RGB, muestreo de texeles cada cuatro píxeles y ponderación de ángulo sólido. Rotación Y 0.4. |
| Sombras | Depth attachment 1024², comparación de profundidad real, PCF 3×3 y filtrado bilineal; normal bias 0.035. Plano receptor visible con el cubo cuando se activan. |
| Acabado | MSAA 4×, curva ACES ajustada y conversión explícita a sRGB. Un postpass opcional separa R/B ±0.012·cantidad y aplica contraste 0.18·cantidad. |

El HDR especular tiene filtrado GGX real y una aproximación analítica de integración BRDF. No es el PMREM de Three ni una garantía de igualdad con los filtros de otros motores. Las luces, la integración HDR, el tratamiento de energía y el tone mapping de este prototipo producen diferencias visuales aunque los parámetros nominales coincidan.

## Pruebas y evidencia

Prueba realizada el 5 de septiembre de 2026 UTC, Chrome 152.0.7977.76 headless, Windows, NVIDIA GeForce RTX 5080, 1440×900 y DPR 1. El [reporte compartido](QA/controls-2026-09-05T04-04-07-104Z/report.json) registra **19/19 comprobaciones aprobadas y cero errores**. Son pruebas funcionales; otras tareas podían compartir la GPU, por lo que no se usan estos FPS para ordenar motores.

| Verificación medida | Resultado |
| --- | --- |
| Transformación individual, expansión y cámara/rotación | Las posiciones de la pieza seleccionada cambian según el contrato; otra pieza conserva su posición local. La cámara/rotación cambian la imagen. |
| Roughness, metalness, clearcoat, entorno, luz, exposición, color, sombras y post | Los nueve controles cambian píxeles. Por ejemplo, roughness da diferencia RGB media 0.186 y clearcoat 0.118 sobre el muestreo de pantalla de 0–255; valores modestos, no juicios de calidad. |
| Onda y densidad | Onda visible con revisión de matrices idéntica; 162 instancias cambian la densidad visible. |
| Reversibilidad | Al restaurar los controles y la pose, diferencia de píxeles muestreados exactamente cero. |
| Compute real | 64 valores GPU exactos, `i*3+7`, de 7 a 196. |
| MRT, alpha y atomics | Dos targets leídos correctamente dentro de ±1 por cuantización UNORM. Contadores atómicos exactos `[64,2016]`. |
| Timestamps opcionales | Feature disponible; el pase MRT de 4×4 devolvió 0 ns. No permite resolver la duración de ese pase ni concluir coste cero. |

El [preflight](QA/native-webgpu-preflight/report.json) conserva el diagnóstico inicial y final, HDR cargado, 7 draws/128,244 triángulos en hero y 12 draws/1,099,776 triángulos en mosaico. Capturas revisadas: [cubo](QA/native-webgpu-preflight/hero.png), [sombras](QA/native-webgpu-preflight/shadows.png) y [onda](QA/native-webgpu-preflight/mosaic-wave.png). Chrome avisó que `powerPreference` se ignora actualmente en Windows; no hubo errores de render o compilación.

Cuatro [pruebas adicionales](QA/native-webgpu-preflight/edge-checks.json) pasaron: interceptar las llamadas reales a `GPUQueue.writeBuffer` confirmó solo dos escrituras de uniforms al cambiar la onda, sin bytes de instancias adicionales; resize 980×700 y regreso a 1440×900; `dispose()` detiene los frames; ausencia **simulada** de `navigator.gpu` produce error explícito, sin crear app. Esta última prueba no representa un navegador físico sin soporte WebGPU.

También pasó `node --check src/kineti/research/nativeWebGPUScene.js`. El decodificador HDR propio se comparó contra `HDRLoader().setDataType(FloatType).parse()` de Three: 1024×512, 2,097,152 valores Float32, cero valores distintos, diferencia máxima cero. El divisor RGBE se ajusta deliberadamente al usado por el fixture de Three.

Reproducción del QA: `KINETI_QA_ENGINE=native_webgpu KINETI_QA_BACKEND=webgpu node scripts/qa-controls.mjs` con el servidor local en 5173; en PowerShell, asignar esas variables mediante `$env:` antes de ejecutar Node.

## API de laboratorio

```js
const app = await createNativeWebGPUComparison(canvas);
app.setControls({ selectedPiece: 26, pieceOffset: 0.625 });
app.setProgress(0.6);
app.getControls();
app.getProbeState();
app.getDiagnostics();
await app.runComputeProbe();
await app.runRawControlProbe();
app.dispose();
```

La página publica esta API en `window.__COMPARISON__`. `device` y `context` también se devuelven para inspección y extensiones directas. Si falta WebGPU, la inicialización falla explícitamente y la página publica `window.__COMPARISON_ERROR__`; no simula una GPU ni cambia de backend silenciosamente.

`runComputeProbe()` despacha 64 invocaciones WGSL y copia un storage buffer a un buffer `MAP_READ`. Espera exactamente `i*3+7` para cada índice, de 7 a 196. Los resultados provienen de `mapAsync`, no de una evaluación CPU de sustitución. El mapeo y la lectura siguen el mecanismo documentado de [GPUBuffer.mapAsync](https://developer.mozilla.org/en-US/docs/Web/API/GPUBuffer/mapAsync).

`runRawControlProbe()` ejecuta operaciones separadas del render normal: dos render targets reales, alpha blending en el primero y reemplazo en el segundo, lectura de ambos, y 64 invocaciones con `atomicAdd` sobre contadores de storage que deben dar `[64,2016]`. Consulta timestamps alrededor del pequeño pase MRT si el adapter anuncia `timestamp-query`; su duración no es un benchmark de la escena. [beginRenderPass](https://developer.mozilla.org/en-US/docs/Web/API/GPUCommandEncoder/beginRenderPass) documenta attachments, clears, MSAA resolve y timestamps opcionales; [WGSL](https://gpuweb.github.io/gpuweb/wgsl/) define tipos de storage y operaciones atómicas.

## Decisión práctica y límites

Esta opción permite decidir explícitamente cada shader, binding, vertex layout, attachment, estado de profundidad, mezcla y orden de pases de este prototipo. La relación entre estados y recursos queda en el código de la aplicación. La API de [createRenderPipeline](https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/createRenderPipeline) expone estos componentes; las decisiones de implementación y sus costes de mantenimiento siguen siendo responsabilidad del proyecto.

Es una opción práctica cuando el producto necesita un renderer propio y el equipo quiere mantener iluminación, filtrado, materiales, recursos y compatibilidad. Para una web 3D que cambie con frecuencia, esos mismos componentes elevan el trabajo frente a un motor existente. La decisión depende de las extensiones concretas que necesite Kineti, no de que el nivel de abstracción más bajo sea automáticamente más conveniente.

El prototipo no incorpora editor visual, picking, importador glTF, animación esquelética, física, transparencias ordenadas, recuperación automática de pérdida del dispositivo, WebXR ni postprocesado general. La escena usa alpha opaco; la mezcla alpha se comprueba en el probe MRT. Estas son ausencias de esta implementación, no prohibiciones de WebGPU. Tampoco se ha probado una cobertura universal de navegadores o móviles físicos.

El referente visual D2C Life Science exige una evaluación de acabado, luz, composición y movimiento independiente de estos checks. El prototipo conserva la geometría acordada y no implementa geometría virtualizada, meshlets, streaming de geometría ni LOD. No se presenta como una implementación de Nanite ni como prueba de equivalencia visual con ese referente. Tener control de bajo nivel permite escribir más técnicas, pero por sí solo no produce ese acabado.

Los FPS son intervalos de `requestAnimationFrame` de hasta 240 muestras e incluyen el planificador del navegador. `cpuEncodeSubmitMs` mide CPU; `gpuFrameMs` permanece nulo. Menos draws en el hero derivan del batching implementado aquí y no demuestran una ventaja intrínseca de WebGPU directo frente a un motor que también pueda agrupar esas instancias.
