# Qué elegimos para Kineti y por qué

Actualizado el 4 de septiembre de 2026, hora local; informes del día 5 UTC. El alcance inicial Three/Babylon se reabrió y amplió con tres implementaciones locales adicionales y Unreal real. [Resultados completos](AB_RESULTS.md).

## Mayor control explícito

**WebGPU directo + WGSL propio** es la respuesta a «quiero decidir cada recurso, shader, binding y pase sin las convenciones de un motor». El prototipo escribió su renderer PBR, filtró el HDR por compute, dibujó instancias, ejecutó shaders completos, verificó dos targets con blending distinto y leyó contadores atómicos reales. No se requiere que una capa de escena exponga primero esas decisiones.

Su límite sigue siendo la API que expone el navegador y el hardware. No concede acceso nativo ilimitado al driver, no implementa automáticamente Nanite y no elimina el trabajo de materiales, compatibilidad, recuperación, gestión de memoria o assets. La [especificación WebGPU](https://gpuweb.github.io/gpuweb/) describe el modelo de recursos y comandos. Las capacidades probadas están separadas de las ausencias de este renderer en [su informe](NATIVE_WEBGPU_FINDINGS.md).

## Implementación de la experiencia visual

**Three 0.185.1 con WebGPURenderer y TSL** se utiliza para desarrollar la web. Los controles gráficos necesarios pasaron en WebGPU y WebGL2, incluida una fórmula GPU compartida. Su sistema de materiales y composición de pases permite trabajar directamente en acabado y coreografía manteniendo ambas rutas. Esa es una ventaja de integración para esta escena, no una afirmación de que dé más granularidad que escribir la API directamente.

Babylon y PlayCanvas también pasaron los controles relevantes. Babylon ofrece interfaces directas para programas WGSL completos y documenta recuperación del dispositivo; PlayCanvas ejecutó shaders completos y MRT en ambas rutas. No se descartaron por falta de potencia. WebGL2 directo también funcionó, con transform feedback para la sonda y un modelo de API distinto de compute WebGPU.

El [manual de Three](https://threejs.org/manual/en/webgpurenderer.html) documenta TSL → WGSL/GLSL y su alternativa WebGL2; también mantiene WebGPURenderer en estado experimental. Por eso fijamos versión y verificamos los efectos de esta escena. No se extrapola que cualquier función WebGPU funcionará en WebGL2.

## Referencia y acabado

La referencia original estaba enlazada en MASTER_PLAN.md: [D2C Life Science](https://www.d2c-lifescience.com/). Revisamos 188 fotogramas, con análisis de placas separables, biseles, muescas, relieve, textura, iluminación y composición. Además la captura del sitio activo detectó Three 179. Ese dato confirma viabilidad visual en esa familia; no es el fundamento único de la elección ni prueba una técnica concreta como Lumen/Nanite.

La nueva geometría y los materiales de la web se desarrollan aparte de las fixtures congeladas. La comparación funcional de motores y la evaluación artística de la landing responden preguntas distintas.

La QA de esa nueva escena encontró un defecto concreto en el observador de materiales de Three r185: tras abrir y cerrar el cubo, una matriz de render podía conservar la pose anterior aunque la matriz de la escena ya fuera correcta. Se reprodujo en ambos backends. La solución usa `material.positionNode = positionLocal`, una expresión TSL de identidad que obliga a refrescar los datos del objeto; no modifica Three instalado. El [diagnóstico y su evidencia](GPU_TRANSFORM_REGRESSION.md) documentan el alcance. Este hallazgo confirma por qué los controles basales no bastan para garantizar todas las secuencias de una aplicación.

## Cuándo cambiar la decisión

- Adoptar el renderer WebGPU propio si un requisito concreto necesita gobernar sus recursos/pases y compensa mantener todo ese sistema y una alternativa de compatibilidad.
- Preferir Babylon o PlayCanvas si sus herramientas, modelo de aplicación o una extensión probada reducen el trabajo de Kineti; los controles comunes ya están verificados.
- Usar Unreal Pixel Streaming si el resultado requiere una escena nativa de Unreal y se acepta operar sesiones remotas, codificación y red. Su prototipo aquí es real; no tiene paridad visual, prueba Nanite o latencia por Internet.
- Evaluar Unity, Godot o Spline mediante exportaciones propias antes de puntuarlos. Están documentados y sus pruebas prácticas siguen pendientes.

No hay un ganador medido de FPS: la salida remota de 32 Hz y las tareas concurrentes impiden esa conclusión. No hay una promesa de «control de absolutamente todo» en todas las plataformas. Hay seis prototipos ejecutados, controles observables y una decisión de implementación revisable con evidencia.
