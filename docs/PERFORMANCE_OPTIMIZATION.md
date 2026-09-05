# Optimización de carga sin reducir el acabado — 5 de septiembre de 2026

La mejora principal elimina programas de shader redundantes del mosaico y adelanta la descarga del entorno. Conserva geometría, materiales, clearcoat, GTAO, denoise, bloom, DOF de escritorio, sombras, coreografía, instancing real y límites de DPR. No introduce un modo de calidad inferior por defecto.

## Resultado medido

Tiempo desde navegación hasta `data-scene="ready"`, incluyendo el calentamiento y el primer render de la pose solicitada:

| Caso | Antes | Después | Reducción |
| --- | ---: | ---: | ---: |
| Escritorio, WebGPU | 3.101 ms | 2.089 ms | 32,6% |
| Viewport móvil, WebGPU | 2.718 ms | 1.944 ms | 28,5% |
| Viewport móvil, WebGPU, CPU ×6 y red limitada | 19.419 ms | 13.968 ms | 28,1% |
| Escritorio, WebGL2 | 21.109 ms | 3.747 ms | 82,3% |
| Viewport móvil, WebGL2 | 13.667 ms | 3.408 ms | 75,1% |

Informes completos: [antes](QA/performance-baseline/report.json), [después](QA/performance-final/report.json). La transferencia de cuerpos HTTP comprimidos permanece prácticamente igual: **1.383.935 → 1.384.549 bytes**, +614 bytes por instrumentación y hints. Esta intervención mejora preparación y orden de carga; no reduce significativamente la descarga.

Chrome 152 sobre la GPU del equipo Windows (RTX 5080), con Puppeteer y servidores Brotli locales: original congelado en 4175 y producción en 4174. Cada caso inicia un navegador con perfil nuevo, caché HTTP deshabilitada y `--disable-gpu-shader-disk-cache`. Esto no garantiza vaciar las cachés internas del controlador. Una ejecución por caso en cada informe; varios ensayos intermedios corroboran la dirección del cambio, pero no constituyen un estudio estadístico de dispositivos.

Escritorio: 1440×900. Móvil: 390×844. La tabla usa DPR de navegador 1 para controlar la comparación; hay una segunda comparación con DPR de navegador 2, que confirma los límites de la aplicación 1,75 y 1,5. La simulación lenta aplica CPU ×6, 150 ms de latencia y 200.000 bytes/s de descarga. **El viewport móvil y el throttling usan la GPU del PC; no sustituyen medir el teléfono físico que tardó más de 30 s.**

## Causa y cambios aplicados

1. **Instancias sin matrices identidad redundantes.** El mosaico ya calculaba toda su pose en TSL mediante `aOrigin`, `aDestination` y `aSeed`. `InstancedMesh` añadía además matrices identidad y buffers con identificadores distintos por malla/compilación en Three r185. El shader capturado repetía código con diferencias como `NodeBuffer_30624` frente a `NodeBuffer_111587`. Ahora usa `Mesh` con `InstancedBufferGeometry` y `geometry.instanceCount`: sigue siendo instancing GPU, con 24 objetos de dibujo, cinco materiales compartidos, capacidad de 80 instancias por lote y 432/162 módulos. Los programas de render creados durante el arranque WebGPU pasan de **103 a 34** en escritorio y de **68 a 23** en móvil. Evidencia de código generado: [auditoría de shaders](QA/performance-shader-audit/report.json); primer ensayo aislado: [instancing](QA/performance-instancing/report.json). El cubo principal mantiene su implementación y el arreglo de matrices `positionNode = positionLocal`.
2. **Entorno solicitado antes.** La promesa de carga/decodificación del mismo EXR empieza antes de inicializar el dispositivo y construir las geometrías. Se espera antes de preparar los materiales y pases. Un preload de prioridad baja permite comenzar incluso antes de ejecutar JavaScript sin desplazar deliberadamente los scripts prioritarios. Conserva EXR 1k, intensidad 0,62, rotación 0,4 y el HDR original como fallback.
3. **Fuente y observabilidad.** Preload de Manrope reutilizado por el CSS; `font-display: swap` ya existía. `startupTimings` y medidas `kineti:*` separan inicialización, descarga/decodificación, geometría, compilación de escena y primeros renders de campo/macro/hero. `initialLoadMs` ahora incluye el primer render. El parámetro opcional `?profile=1` registra coste exclusivo de envío CPU por material y retira su hook antes del bucle interactivo.

Los shaders explican una parte importante del bloqueo observado: en el caso lento original el EXR termina alrededor de 8,1 s y `ready` llega a 19,4 s; en WebGL de escritorio las llamadas bloqueantes a `getProgramParameter` acumulan aproximadamente 15,5 s. Sin embargo, CPU, construcción TSL, driver y GPU se solapan. Los tiempos de llamadas CPU no son tiempos GPU puros, y no permiten atribuir los 30 s de un teléfono no conectado exclusivamente a su GPU.

## Pases, bundle y alternativas evaluadas

| Evaluación | Evidencia y decisión |
| --- | --- |
| GTAO/denoise/bloom/DOF/clearcoat | [Perfil de arranque](QA/performance-passes/report.json), [perfil WebGL](QA/performance-passes-webgl/report.json). Se distinguen materiales, PMREM y cadena de composición. Los hooks públicos no aíslan todos los pases internos; no se atribuyen costes individuales de GTAO frente a denoise/bloom ni coste marginal exclusivo de clearcoat. Se conservaron todos. |
| `?ao=off` | [Control](QA/performance-ao-off/report.json): WebGL móvil 3.443 ms frente a 3.391 ms con AO en el ensayo de perfil. El flag pone su contribución a cero, pero no elimina el grafo del pipeline; no demuestra ahorro de compilación. No se habilitó por defecto. |
| Compilar sólo objetos representativos | [Ensayo](QA/performance-compile/report.json). Sin ganancia consistente y desplazando trabajo al primer dibujo. Revertido; sigue el calentamiento de poses reales, sin añadir una fase posterior que pueda trabar el scroll. |
| Compartir también materiales del hero | [Ensayo](QA/performance-shared/report.json). No resolvía la duplicación dominante del campo. Revertido para limitar los cambios. |
| EXR 512 px | Candidato de 403.847 bytes, frente a 1.056.599 del original. [Capturas y comparación](QA/performance-ibl512/image-comparison.json): muy parecido, pero no idéntico; error RGB medio máximo aproximado 0,126/255. No se adoptó por la prioridad de conservar el acabado y la falta de validación en teléfonos. El candidato queda sólo en `backups/performance-20260905/`, fuera de producción. La sustitución para capturas usa interceptación; no es una medición real de transferencia del servidor. |
| EXR 1k sin pérdida | PIZ: 1.062.812 bytes; PXR24: 1.153.391; ZIPS: 1.167.081. Píxeles decodificados idénticos en estas conversiones, pero ninguna pesa menos que el EXR actual. Descartadas. |
| KTX2 | No implementado ni validado. Requiere evaluar formato HDR, soporte/transcodificación móvil y fidelidad; no se presume una mejora sin evidencia. |
| Chunk llamado `symbols` | La [auditoría de módulos](QA/performance-bundle/report.json) muestra principalmente el renderer y core de Three compartidos, no 890 KB de glifos personalizados. Longitudes antes de minificar: Three WebGPU ≈1,92 MB, core ≈858 KB; el módulo de símbolos de investigación ≈8 KB. El grafo inicial ya excluye los imports dinámicos del laboratorio. No se eliminaron piezas del motor necesarias por confundir el nombre del chunk con su contenido. |
| Import dinámico del HDR de fallback | [Ensayo intermedio](QA/performance-network/report.json). Añadía fragmentación sin ahorro significativo en el camino inicial. Revertido; se mantiene el import estático. |

## Calidad y fluidez

Se compararon **49 pares de capturas**: siete posiciones de scroll en cinco casos a DPR 1 y dos casos adicionales con DPR de navegador 2. Comparación RGB completa, sin recortar ni redimensionar, y revisión visual de capturas antes/después:

- [Diferencias por píxel](QA/performance-final/image-comparison.json) y [SSIM](QA/performance-final/ssim.json): error RGB medio máximo 0,076/255; SSIM mínimo 0,9994877.
- [Diferencias con DPR alto](QA/performance-final-dpr2/image-comparison.json) y [SSIM](QA/performance-final-dpr2/ssim.json): SSIM mínimo 0,9996374.
- Macro escritorio: [antes](QA/performance-baseline/desktop-074.png) / [después](QA/performance-final/desktop-074.png).
- Cubo abierto móvil: [antes](QA/performance-baseline/mobile-023.png) / [después](QA/performance-final/mobile-023.png).
- Reensamblado final: [antes](QA/performance-baseline/desktop-100.png) / [después](QA/performance-final/desktop-100.png).

No son imágenes idénticas píxel a píxel. Hay diferencias pequeñas compatibles con ruido de muestreo y precisión aritmética; fijar `Math.random` no iguala su secuencia si cambia el orden de asignación de geometrías/UUID. No se detectó pérdida perceptible al revisar las capturas. SSIM es evidencia complementaria, no una garantía perceptual universal.

Los informes [antes con DPR alto](QA/performance-baseline-dpr2/report.json) y [después con DPR alto](QA/performance-final-dpr2/report.json) incluyen 120 muestras útiles de scroll tras 60 de calentamiento. El intervalo medio fue prácticamente igual, ≈6,05 ms, limitado por la cadencia del entorno; **no se afirma una mejora de FPS demostrada**. La escena sigue dejando de dibujar al asentarse: cero frames nuevos en un segundo de reposo. Se preservan DPR, movimiento reducido, navegación durante carga, variantes opcionales y fallbacks.

## Verificación y reproducción

- QA general: [230/230](QA/run-2026-09-05T19-15-15-447Z/report.json), escritorio y móvil, WebGPU y WebGL2, navegación, render real, accesibilidad funcional y carga lenta.
- Regresión de ida/vuelta y reposo: [28/28](QA/premium-regression-2026-09-05T19-14-22-655Z/report.json).
- Variantes grain/RGB/hover/idle y fallbacks HDR, WebGL automático y escena estática: [27/27](QA/performance-preservation/report.json). El entorno se descarga una sola vez en los casos comprobados.
- Comprobación tras la compilación y precompresión final: [escritorio y móvil](QA/performance-delivery/report.json), sin errores, 2.103/1.937 ms hasta ready; los nombres de los assets coinciden con la versión medida. HTTP 200 con `Content-Encoding: br` y fuentes descargadas una sola vez.
- La primera ejecución de QA general encontró 25 fallos en la prueba que oculta el canvas: capturaba durante su transición CSS de opacidad de 650 ms. Se corrigió sólo la prueba, deshabilitando esa transición durante su aislamiento y comprobando opacidad cero antes de capturar el control. No se redujeron umbrales ni se modificó la transición de producción. [Intento conservado](QA/run-2026-09-05T19-07-45-823Z/report.json).

Comandos en Git Bash, con el servidor de producción activo:

```bash
npm run build:lab && npm run precompress
npm run serve
# En otra terminal:
KINETI_QA_URL=http://127.0.0.1:4174 npm run qa:scene
KINETI_QA_URL=http://127.0.0.1:4174 npm run qa:regression
node scripts/qa-performance-preservation.mjs
KINETI_PERF_OUT=docs/QA/performance-new node scripts/profile-startup.mjs
KINETI_PERF_DPR=2 KINETI_PERF_MOTION=1 KINETI_PERF_CASES=desktop,mobile KINETI_PERF_OUT=docs/QA/performance-new-dpr2 node scripts/profile-startup.mjs
node scripts/compare-performance-images.mjs docs/QA/performance-baseline docs/QA/performance-new
node scripts/audit-website-bundle.mjs
```

Para repetir el control original: `SERVE_ROOT=backups/performance-20260905/dist-lab node scripts/serve-dist.mjs 4175 127.0.0.1`, y dirigir el perfil a ese puerto mediante `KINETI_QA_URL`. Los fuentes originales relevantes también están en esa copia local, excluida de Git. Para instrumentar costes por material: `KINETI_PERF_QUERY=profile=1`; el flag está desactivado por defecto. Tras completar la validación, el usuario autorizó guardar todos los cambios del proyecto mediante commit y push.
