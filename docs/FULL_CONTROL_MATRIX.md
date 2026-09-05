# Control granular: cinco implementaciones web

Versión ampliada del ensayo, septiembre de 2026. **P** significa ejecutado y observado en este proyecto; **D** significa API/código documentado, sin prueba equivalente; **—** significa no implementado/probado en la fixture, no imposibilidad del motor. La [evidencia de las ocho rutas](QA/control-summary.json) y los informes por candidato permiten revisar los resultados. No hay puntuaciones ponderadas inventadas.

| Dominio | Three 0.185.1 | Babylon 9.25.0 | PlayCanvas 2.22.0 | WebGPU directo | WebGL2 directo |
| --- | --- | --- | --- | --- | --- |
| Posición de una pieza aislada | P: Object3D | P: TransformNode | P: Entity | P: matrices/buffer propios | P: matrices/uniforms propios |
| Transformaciones y cámara | P: XYZ, FOV, expansión | P: mismos controles | P: mismos controles | P: mismos controles | P: mismos controles |
| Reversibilidad absoluta | P | P | P | P | P |
| Control PBR | P: material físico/nodos | P: PBRMaterial | P: StandardMaterial | P: GGX/Smith/Schlick propios | P: GGX/Smith/Schlick propios |
| Clearcoat / metal / rugosidad | P: cambios de píxeles | P: cambios de píxeles | P: cambios de píxeles | P: cambios de píxeles | P: cambios de píxeles |
| HDR especular | P: PMREM | P: filtrado del motor | P: atlas del motor | P: 11 mips GGX por compute | P: mips ordinarios, sin prefiltrado GGX |
| Iluminación y exposición | P | P | P | P | P |
| Mapa de sombras | P | P: shader de sombra extendido | P: variante de sombra extendida | P: depth target y PCF propios | P: depth FBO y PCF propios |
| Instancing 432/162 | P | P | P | P | P |
| Onda GPU sin renovar matrices | P: TSL | P: MaterialPlugin WGSL/GLSL | P: chunks WGSL/GLSL | P: WGSL | P: GLSL |
| Shader de pantalla propio | P: nodos | P: postproceso propio | P: fuentes completas | P: pipeline propio | P: programa propio |
| Una fórmula para WGSL y GLSL | P: TSL para la onda | Dos implementaciones en esta fixture | Dos implementaciones en esta fixture | —: solo WGSL | —: solo GLSL |
| Programas nativos completos | D: nodos/funciones y acceso al backend | P: interfaz WGSL/GLSL del post | P: vertex/fragment propios | P: todos los shaders | P: todos los shaders |
| Dos attachments (MRT) con lectura | D: API, sin sonda equivalente | D: API, sin sonda equivalente | P: ambos backends | P: lectura y mezcla por target | P: lectura de ambos targets |
| Compute GPU y storage readback | P: WebGPU | P: WebGPU | P: WebGPU | P: WebGPU | No compute nativo en esta API |
| Alternativa a compute en WebGL2 | P: transform feedback para 64 valores | —: sonda informa límite | D: TF existe; sonda informa límite | —: no ruta WebGL2 | P: transform feedback para 64 valores |
| Atomics en storage | D: no sonda equivalente | D: no sonda equivalente | D: no sonda equivalente | P: contadores [64,2016] | No modelo equivalente de storage/atomics |
| Selección de backend | P: WebGPU y WebGL2 forzado | P: ambos | P: ambos | P: WebGPU; error explícito sin API | P: solo WebGL2 |
| Recuperación tras pérdida real | D: aplicación debe gestionarla | D: motor implementa recuperación | —: no se forzó pérdida | —: no se implementó recuperación | —: no se implementó recuperación |
| Tiempos GPU comparables | — | — | — | Feature consultada; sonda 4×4 dio 0 ns, no medición útil | Extensión consultada; sin benchmark |
| Gestión de recursos/pases | Motor + extensiones | Motor + extensiones | Motor + extensiones | P: aplicación define pipelines, buffers y comandos | P: aplicación define programas, buffers y FBO |
| Editor visual / importación / física | Fuera del ensayo; ver matriz inicial | Fuera del ensayo; ver matriz inicial | D: herramientas del motor; no usadas aquí | —: no implementados | —: no implementados |
| XR, esqueletos, LOD, geometría virtualizada | No ensayados | No ensayados | No ensayados | No implementados | No implementados |
| Móviles físicos y Safari | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |

## Cómo interpretar «control»

Las cinco implementaciones pasaron los controles de la escena. Una API de nivel inferior expone decisiones directamente, pero no constituye por sí sola una prueba de que el mismo trabajo sea imposible mediante extensiones de un motor. Una función ausente de una fixture tampoco demuestra ausencia de esa capacidad en la biblioteca.

WebGPU directo tiene el acceso más explícito en estas implementaciones: su código define los recursos, pipelines, attachments y despachos. Three/Babylon/PlayCanvas proporcionan trabajo ya resuelto y puntos de extensión. En Three se probó el beneficio concreto de una fórmula TSL que funciona en dos backends; en Babylon y PlayCanvas se escribieron versiones nativas separadas para las extensiones de esta comparación.

No se midió qué API es más rápida de usar para todas las tareas. El tiempo de construcción de una fixture incorpora experiencia del autor, depuración e instrumentación. Los 148 checks tampoco son 148 capacidades distintas, ni miden acabado o FPS.

La escena principal ampliada descubrió además una [regresión de matrices en Three r185](GPU_TRANSFORM_REGRESSION.md) durante `1 → 0 → .23 → 1`. Se corrigió mediante una expresión TSL pública, y se añadió comparación real de imágenes a las comprobaciones de matrices CPU. Es un caso adicional de la aplicación, fuera de las fixtures congeladas; no se extrapola el resultado basal a cualquier secuencia o escena.

## Otras arquitecturas y fuentes

Unreal tiene un [prototipo real de Pixel Streaming](ENGINE_OPTIONS.md): controla una escena nativa y transmite vídeo. Sus 12 pruebas son independientes porque no comparte geometría/materiales/HDR con el contrato principal. No se ensayaron Nanite, Lumen ni latencia visual por Internet. Blender es autoría. Para Unity, Godot y Spline se revisó la documentación de exportación; no se construyó ni ejecutó una escena propia.

Los detalles y fuentes primarias están en la [matriz inicial de 34 criterios](CONTROL_MATRIX.md), [PlayCanvas](PLAYCANVAS_FINDINGS.md), [WebGPU directo](NATIVE_WEBGPU_FINDINGS.md), [WebGL2 directo](NATIVE_WEBGL_FINDINGS.md) y [opciones de motores](ENGINE_OPTIONS.md). [Three WebGPURenderer](https://threejs.org/manual/en/webgpurenderer.html), [PlayCanvas shaders](https://developer.playcanvas.com/user-manual/graphics/shaders/), [WebGPU](https://gpuweb.github.io/gpuweb/) y [WebGL2](https://registry.khronos.org/webgl/specs/latest/2.0/) documentan las interfaces relevantes.
