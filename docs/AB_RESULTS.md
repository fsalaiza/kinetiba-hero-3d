# Kineti: comparación de seis prototipos

La comparación se amplió a **Three 0.185.1, Babylon 9.25.0, PlayCanvas 2.22.0, WebGPU directo, WebGL2 directo y Unreal 5.7.4 con PixelStreaming2**. Las cinco implementaciones locales comparten geometría y un contrato funcional; Unreal prueba otra arquitectura y no tiene paridad visual con ellas. Unity, Godot y Spline están documentados, sin una exportación propia probada. No se han probado todas las opciones existentes.

**Control más explícito del pipeline: WebGPU directo con WGSL propio.** Permite definir recursos, layouts, bindings, attachments, profundidad, blending y secuencia de comandos directamente dentro de los límites de la API del navegador. Esto no significa que los motores impidan usar esas capacidades ni que escribirlo manualmente produzca mejor imagen.

**Implementación de la web Kineti: Three WebGPURenderer y TSL**, por su composición de materiales/pases y una fórmula de animación verificada en WebGPU y WebGL2. Esta es una decisión de implementación para la experiencia; la granularidad máxima sin una capa de motor corresponde al prototipo directo. No se adjudica a Three una superioridad universal, de acabado o de rendimiento.

## Abrir las pruebas

- [Laboratorio de cinco implementaciones](http://127.0.0.1:5173/research/ab.html): conserva controles, cambia de renderer, ejecuta sondas y descarga resultados.
- [Unreal real en el navegador](http://127.0.0.1:8899): vídeo y controles del proceso local de Unreal. Requiere el proceso iniciado por su [launcher](../research-engines/unreal/README.md).
- [Referencia D2C por escenas](http://127.0.0.1:5173/research/reference.html): visor de las 188 capturas originales, dividido en 12 fases observadas.
- [Web Kineti](http://127.0.0.1:5173/).

Si el servidor está cerrado, el acceso del escritorio **Kineti - Laboratorio A-B** ejecuta [Open-Kineti.ps1](../scripts/Open-Kineti.ps1). **Kineti - Web** abre la experiencia.

## Resultados observados

| Implementación / backend | Checks completos | Compute / readback | Sonda avanzada |
| --- | ---: | --- | --- |
| Three / WebGPU | 18/18 | 64 valores exactos en compute GPU | MRT/atomics no probados aquí |
| Three / WebGL2 | 18/18 | 64 valores mediante transform feedback | MRT no probado aquí |
| Babylon / WebGPU | 18/18 | 64 valores exactos en compute GPU | MRT/atomics no probados aquí |
| Babylon / WebGL2 | 18/18 | Informa compute nativo no disponible | MRT no probado aquí |
| PlayCanvas / WebGPU | 19/19 | 64 valores exactos en compute GPU | Dos targets con shader propio, lectura validada |
| PlayCanvas / WebGL2 | 19/19 | Informa compute nativo no disponible | Dos targets con shader propio, lectura validada |
| WebGPU directo | 19/19 | 64 valores exactos en compute GPU | Dos targets, blending distinto, atomics [64,2016] |
| WebGL2 directo | 19/19 | 64 valores mediante transform feedback | Dos targets y lectura validada |

**148 comprobaciones funcionales completas, cero errores en las ejecuciones seleccionadas.** El [resumen JSON](QA/control-summary.json) enlaza cada informe original. Ejecutar `node scripts/summarize-controls.mjs` vuelve a calcularlo. Una comprobación aprobada de «no soportado» no equivale a ejecutar esa función. Los checks adicionales tampoco hacen que 19 sea una mejor puntuación de motor que 18.

El [laboratorio compilado](QA/lab-2026-09-05T04-35-25-643Z/report.json) completó otras **72/72 comprobaciones de interfaz**, con cero errores: cinco candidatas, ocho rutas, controles persistentes, teclado, lectura GPU, cambio rápido durante una sonda, una sola escena activa, redimensionado móvil y descargas JSON reales. No se suman como capacidades adicionales del motor.

En las cinco implementaciones cambiaron realmente los píxeles al ajustar cámara, rugosidad, metal, clearcoat, entorno, luz, exposición, glifos, sombras y postprocesado. Se verificaron posición individual, expansión, densidad, reversibilidad y onda GPU sin actualizar matrices de instancias. Las unidades, integración PBR, filtros HDR y orden de tone mapping varían: mismos valores nominales no significan igualdad radiométrica.

Unreal completó **12/12 pruebas separadas** de vídeo, piezas, cámara, progreso, scroll continuo y reversibilidad. El [informe](../research-engines/unreal/evidence/qa-report.json) registra 503 fotogramas H.264 decodificados y ACK de coordenadas. El ACK mediano de 8.8 ms es local y **no mide input-to-pixel**. No se suma a las 148 pruebas equivalentes como si fuera el mismo ensayo.

## Lectura granular

- [Matriz ampliada de control](FULL_CONTROL_MATRIX.md): cinco implementaciones, evidencia y límites.
- [Matriz inicial de 34 criterios Three/Babylon](CONTROL_MATRIX.md): distinción entre API documentada y prueba ejecutada.
- [PlayCanvas](PLAYCANVAS_FINDINGS.md), [WebGPU directo](NATIVE_WEBGPU_FINDINGS.md), [WebGL2 directo](NATIVE_WEBGL_FINDINGS.md), [Unreal y demás herramientas](ENGINE_OPTIONS.md).
- [Decisión y condiciones](RENDERER_DECISION.md).

## Rendimiento y límites

Chrome 152, Windows y RTX 5080, viewport de referencia 1440×900 a DPR 1. La [pantalla remota está a 32 Hz](QA/display-context.json), aunque hay una salida física de la RTX a 165 Hz. Los intervalos rAF observados alrededor de 31 ms reflejan ese entorno y no permiten elegir un ganador GPU. Hubo otros procesos gráficos activos. No se hicieron ensayos de teléfonos físicos, Safari, consumo energético, pérdida real de dispositivo o latencia por Internet.

Los prototipos comparten utilidades de autoría de Three y el laboratorio carga instrumentación; sus bundles no son builds aislados de producción equivalentes. WebGPU directo agrupa el hero en siete draws; es una optimización implementada en ese fixture, no una capacidad exclusiva frente a motores que también ofrecen instancing.

Los intentos interrumpidos por navegación de Vite y el primer detector de clearcoat demasiado grueso permanecen registrados. Los informes de arriba seleccionan ejecuciones completas; no ocultan los fallos originales ni los atribuyen al renderer.

El acabado de D2C se estudia aparte en [12 fases](D2C_SCENE_ANALYSIS.md). La inspección del sitio activo encontró `window.__THREE__ === '179'`; demuestra que ese referente usa Three, no que una librería produzca automáticamente esa calidad. La colección de 188 capturas no equivale a todo su scroll ni demuestra su final. Ningún prototipo se presenta como Nanite real.

## Reproducir

`npm run qa:controls` ejecuta las ocho rutas locales; `npm run qa:comparison` conserva el ensayo basal Three/Babylon. `npm run build` genera la web en dist; `npm run build:lab` compila el laboratorio en dist-lab; `npm run build:library` conserva la biblioteca original en dist-library. La QA de la experiencia principal es independiente: `npm run qa:scene`.
