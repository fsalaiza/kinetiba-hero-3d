# WebGL2 directo: control sin renderer de motor

La fixture [native-webgl.html](../research/native-webgl.html) usa shaders GLSL ES 3.00, VAO, buffers, uniforms, framebuffers y llamadas de dibujo WebGL2 escritos para esta prueba. Three aporta geometría, matrices y lectura HDR; no renderiza la escena. El código está en [nativeWebGLScene.js](../src/kineti/research/nativeWebGLScene.js).

Se conserva el contrato de 27 piezas, 54 símbolos, cámara, materiales nominales y mosaico de 432/162 instancias. La onda modifica uniforms y mantiene los buffers de instancia. Hay PBR GGX/Smith/Schlick con clearcoat, HDR, sombras PCF con mapa 1024² y postprocesado RGB/contraste en framebuffer propio. La rugosidad usa mipmaps ordinarios del HDR: este prototipo **no prefiltra el entorno con GGX**, a diferencia de la implementación WebGPU directa. Es una limitación del trabajo realizado, no una imposibilidad de WebGL2.

El contexto solicita antialias para el framebuffer principal. El efecto opcional usa un framebuffer intermedio de una muestra; no equivale a un pipeline completo con MSAA en todos los pases. Son diferencias relevantes al evaluar las capturas.

## Evidencia

[19/19 comprobaciones aprobadas](QA/controls-2026-09-05T04-10-52-769Z/report.json), Chrome 152, Windows, RTX 5080, 1440×900 a DPR 1. Se comprueban aislamiento de pieza, transformaciones, cámara, nueve controles visuales, onda sin actualizar matrices, densidad, reversibilidad, lectura GPU, MRT y ausencia de errores. No es una medición de todas las capacidades de la API.

La primera ejecución fue interrumpida por una navegación de Vite. Otra ejecución completa detectó un cambio de clearcoat inferior al umbral inicial de diferencias por píxel: el render sí cambiaba. Se ajustó el detector compartido para contar cualquier cambio RGB cuantizado en las pruebas de materiales, manteniendo el umbral de diferencia media. Ambos informes originales se conservan; el ajuste no cambia el shader para hacer pasar la prueba.

`runComputeProbe()` obtiene los 64 valores `i*3+7` mediante **transform feedback** y `getBufferSubData`. No es un compute shader general: WebGL2 no expone el modelo de compute/storage/atomics de WebGPU. [Especificación WebGL2](https://registry.khronos.org/webgl/specs/latest/2.0/).

`runRawControlProbe()` escribe dos attachments RGBA8 y verifica sus píxeles mediante `readPixels`, con tolerancia ±1 de cuantización. El resultado informa atomics como no disponibles. La extensión de tiempos GPU se consulta, pero no hay tiempos GPU fiables medidos de esta escena ni clasificación de rendimiento.

## Implicaciones

Esta implementación permite controlar directamente atributos, uniforms, compilación, estados, pases, instancias, vida de recursos y readback. Es necesario mantener manualmente ese código, el modelo de iluminación y sus alternativas de compatibilidad. No se implementaron importación glTF, física, XR, recuperación del contexto ni un editor.

La ejecución directa de WebGL2 es una opción real para navegadores con esta API. Escribir un renderer propio ofrece acceso explícito; no produce automáticamente mejor acabado, menor coste GPU o menos código de producción. El prototipo no implementa Nanite, geometría virtualizada o streaming de geometría.
