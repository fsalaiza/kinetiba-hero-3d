# Kineti — Business Advantage

Experiencia web de un cubo 3D controlado por scroll: se abre, revela sus capacidades, forma un campo de piezas y vuelve a integrarse. El mensaje conecta datos verificables, tuberías deterministas, inteligencia agéntica y decisiones compartidas.

El proyecto incluye una comparación independiente de cinco implementaciones gráficas en navegador y un prototipo de Unreal con Pixel Streaming. El análisis del referente original D2C está dividido en 12 fases con un visor de las 188 capturas existentes.

## Ejecutar

Requiere Node.js y npm. Las versiones exactas de motores están fijadas en package-lock.json.

```powershell
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

- [Web Kineti](http://127.0.0.1:5173/)
- [Laboratorio: Three, Babylon, PlayCanvas, WebGPU y WebGL2 directos](http://127.0.0.1:5173/research/ab.html)
- [Referencia por escenas](http://127.0.0.1:5173/research/reference.html)

En este equipo también están los accesos de escritorio **Kineti - Web** y **Kineti - Laboratorio A-B**. Ejecutan `scripts/Open-Kineti.ps1`, que inicia el servidor local si hace falta y abre el navegador. El launcher no instala dependencias.

Unreal se inicia por separado; ver [su README](research-engines/unreal/README.md). Su cliente usa el puerto 8899 y requiere Unreal Engine 5.7 instalado. Es un proceso nativo que transmite vídeo, no un exportador HTML de Unreal.

## Compilación y comprobaciones

| Comando | Resultado |
| --- | --- |
| `npm run build` | Web en dist |
| `npm run build:lab` | Web, laboratorio y visor de referencia en dist-lab |
| `npm run precompress` | Brotli y gzip de los archivos compilados |
| `npm run serve` | Servidor de dist-lab con compresión en http://127.0.0.1:4174 |
| `npm run preview:lab` | Preview compilado en http://127.0.0.1:4174 |
| `npm run build:library` | Biblioteca original en dist-library |
| `npm run qa:scene` | Pruebas reales de la web en Chrome instalado, con viewport de escritorio y móvil |
| `npm run qa:regression` | Regresión de matrices GPU: imágenes al retroceder, retorno del mosaico y pausa de render en reposo |
| `npm run qa:controls` | Controles de las ocho rutas motor/backend |
| `node scripts/qa-lab.mjs` | UI del laboratorio compilado |
| `npm run qa:comparison` | Comparación basal original Three/Babylon |
| `node scripts/summarize-controls.mjs` | Recalcula el resumen de ejecuciones completas seleccionadas |

Los scripts de QA usan Chrome/Edge ya instalado; Puppeteer no descarga un navegador durante las pruebas. En PowerShell se puede seleccionar una ruta, por ejemplo `$env:KINETI_QA_ENGINE='native_webgpu'`. El servidor debe estar activo. HMR está desactivado por defecto para que las ediciones no interrumpan las sesiones de QA; se activa con `$env:KINETI_HMR='true'` antes de arrancar Vite.

## Estructura

- `src/kineti/KinetiExperience.jsx` y `kineti.css`: contenido, navegación, accesibilidad y formulario local.
- `src/kineti/createExperience.js`: escena principal, materiales, luces y coreografía.
- `src/kineti/research/`: fixtures gráficas independientes y congeladas para la comparación.
- `research/`: laboratorio, páginas de cada renderer y visor del referente.
- `research-engines/unreal/`: prototipo C++ y señalización local aislados.
- `docs/QA/`: informes y capturas de las ejecuciones, incluidos intentos fallidos.
- `screenshots/qa-fixes/`: capturas antes/después de las correcciones de QA (numeración de fases, transiciones del final y de Conectar en móvil, tooltip de fases, encuadre del laboratorio).
- `vite.library.config.js`: conserva la compilación del componente anterior.

La copia previa de la web está en `backups/pre-kineti-motion-20260904-205905`. Los archivos Blender y modelos anteriores se conservaron. Los respaldos y builds generados están excluidos de Git.

## Decisiones y alcance

[Resultados y evidencias](docs/AB_RESULTS.md) · [Matriz ampliada de control](docs/FULL_CONTROL_MATRIX.md) · [Decisión de renderer](docs/RENDERER_DECISION.md) · [Acabado y validación de la web](docs/PREMIUM_VISUAL_IMPLEMENTATION.md) · [Análisis D2C](docs/D2C_SCENE_ANALYSIS.md) · [Contexto de Kineti](docs/KINETI_PROJECT_CONTEXT.md).

La versión compilada pasó 230 comprobaciones de navegación, contenido, accesibilidad funcional y render, 28 de regresión visual y reposo, y 27 de variantes y fallbacks. La optimización de carga redujo navegación→escena lista en escritorio de 3,10 a 2,09 s con WebGPU y de 21,11 a 3,75 s con WebGL2. Se conservaron los efectos y el entorno 1k; 49 pares de capturas no muestran pérdida perceptible. [Mediciones, capturas, alternativas descartadas y límites](docs/PERFORMANCE_OPTIMIZATION.md). Son resultados del equipo de prueba; el viewport móvil no sustituye un teléfono físico.

El renderer principal usa Three WebGPURenderer/TSL. WebGPU directo aporta el control más explícito de recursos y pases en el ensayo. No se afirma un ganador universal de calidad o FPS: las comparaciones funcionales y la evaluación visual son distintas, y la pantalla remota a 32 Hz condiciona los intervalos de fotogramas registrados.

## Variantes visuales opcionales (web principal)

Desactivadas por defecto; se activan con parámetros de consulta y aparecen en `getDiagnostics().variants`:

| Parámetro | Efecto |
| --- | --- |
| `?grain=1` | Grano fílmico animado sobre todo el frame (overlay CSS; respeta movimiento reducido) |
| `?fx=rgb` | Aberración cromática sutil en la composición (pipeline TSL alternativo) |
| `?hover=1` | El cursor levanta y resalta la pieza individual bajo el puntero (raycast) |
| `?idle=1` | Rotación lenta continua en reposo (desactiva el render-en-reposo mientras esté activa) |

Combinables, p. ej. `/?grain=1&idle=1`. El laboratorio añade el control **Encuadre automático** (`autoFrame`, activo por defecto): al aumentar la separación de piezas la cámara retrocede para conservar el conjunto en pantalla. Desactívalo para comparar motores con cámara fija en igualdad de condiciones.

El formulario prepara un brief que el visitante puede copiar o descargar. No tiene backend de contacto ni envía datos. La experiencia respeta la preferencia de movimiento reducido y tiene navegación por fases. La verificación con viewport móvil no sustituye pruebas en teléfonos físicos.

Las capturas D2C se usan como referencia de análisis del proyecto; no son los materiales ni modelos de la web principal.
