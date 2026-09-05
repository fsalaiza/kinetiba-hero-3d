# Estado para retomar Kineti después del reinicio

Guardado el 5 de septiembre de 2026, a petición del usuario antes de reiniciar Windows. Este archivo es la nota persistente de continuidad del proyecto.

## Ubicación y estado guardado

- Repositorio local: `C:\Users\fsala\Documents\GitHub\kinetiba-hero-3d`.
- Remoto: `https://github.com/fsalaiza/kinetiba-hero-3d.git`, rama `main`.
- Commit de la implementación y optimización: `49d35542c021768901c4ffc521ae6666ff624677`, confirmado en `origin/main` antes de añadir esta nota.
- El usuario autorizó commit y push de todo el proyecto una vez terminadas las verificaciones. Se incluyeron fuentes, investigación, modelos, informes y capturas. `backups/`, `node_modules/` y builds están excluidos.
- La optimización está terminada. No hay una corrección de rendimiento pendiente que deba reanudarse automáticamente; la siguiente acción es volver a iniciar la web y comprobarla en el celular.

## Volver a abrir tras reiniciar

El reinicio detiene el servidor Node. No se configuró inicio automático de Kineti. Desde Git Bash:

```bash
cd /c/Users/fsala/Documents/GitHub/kinetiba-hero-3d
npm run serve
```

Desde PowerShell:

```powershell
Set-Location 'C:\Users\fsala\Documents\GitHub\kinetiba-hero-3d'
npm run serve
```

Mantener esa terminal abierta, o iniciar el mismo servidor como proceso oculto si lo hace el asistente. Antes de arrancarlo comprobar si 4174 ya está ocupado por Kineti; no matar servicios indiscriminadamente.

El build final ya está en `dist-lab/` y sobrevive al reinicio. Si falta o se modifica código, ejecutar en orden `npm run build:lab` y `npm run precompress` antes de servir. Si faltan dependencias, `npm ci`. No usar `vite preview` para medir la transferencia: el servidor propio sirve los archivos Brotli/gzip.

- Web local: `http://127.0.0.1:4174/`.
- Laboratorio: `http://127.0.0.1:4174/research/ab.html`.
- Celular, HTTPS: `https://alfred.tailfbd6cc.ts.net/`.
- Último estado comprobado: Tailscale Funnel ya estaba activo y reenviaba `/` a `http://127.0.0.1:4174`. El enlace respondía HTTP 200, Brotli y el asset final `website-D-yiEWFH.js`. No se activó Funnel durante esta sesión; se verificó la configuración existente.
- Tras el reinicio, verificar que Tailscale esté conectado y consultar `& 'C:\Program Files\Tailscale\tailscale.exe' serve status` en PowerShell. La PC debe permanecer encendida y conectada. El enlace Funnel permite acceso sin activar Tailscale en el celular.
- Los accesos existentes **Kineti - Web** y **Kineti - Laboratorio A-B** llaman a `scripts/Open-Kineti.ps1` y arrancan Vite en 5173. Sirven para desarrollo; no restauran el servidor de producción al que apunta Funnel.

## Qué se optimizó y qué se preservó

Three `0.185.1`, Vite, WebGPURenderer + TSL con fallback WebGL2 automático. Narrativa de seis fases y mosaico con 432 módulos en escritorio / 162 en móvil. Conserva efectos, materiales PBR con clearcoat, GTAO/denoise, bloom, DOF de escritorio, sombras, entorno EXR 1k, DPR máximo 1,75 escritorio / 1,5 móvil, reposo sin dibujos GPU, accesibilidad y fallback estático.

La mejora principal elimina matrices identidad redundantes del mosaico: ahora usa `Mesh` + `InstancedBufferGeometry` y `geometry.instanceCount`, manteniendo el instancing real. Los programas de render de arranque WebGPU bajan de 103 a 34 en escritorio y de 68 a 23 en móvil. Se adelantó la carga del EXR y se añadieron preloads del entorno y Manrope. El hero conserva `positionNode = positionLocal`, arreglo necesario para el refresco correcto de matrices GPU.

Tiempo navegación → `data-scene="ready"`:

| Caso | Antes | Después |
| --- | ---: | ---: |
| Escritorio WebGPU | 3,10 s | 2,09 s |
| Viewport móvil WebGPU | 2,72 s | 1,94 s |
| Viewport móvil, CPU ×6 y red limitada | 19,42 s | 13,97 s |
| Escritorio WebGL2 | 21,11 s | 3,75 s |
| Viewport móvil WebGL2 | 13,67 s | 3,41 s |

Los casos móviles usan la GPU del PC RTX 5080; no se ha repetido la medición en el teléfono real que tardó más de 30 s. La descarga permanece prácticamente igual. No hay mejora de FPS demostrada. Se compararon 49 pares de capturas, SSIM mínimo 0,9994877, sin pérdida perceptible en la revisión visual. No son imágenes idénticas píxel a píxel.

Se descartaron EXR 512 por no ser idéntico y no tener validación física móvil; otras compresiones EXR sin pérdida por ser mayores; import dinámico del HDR y compilación de objetos representativos por falta de ganancia consistente. KTX2 no se implementó ni validó. El chunk `symbols` contiene principalmente Three compartido, no cientos de KB de glifos propios.

## Evidencia y pruebas

Consultar [PERFORMANCE_OPTIMIZATION.md](PERFORMANCE_OPTIMIZATION.md) para método, limitaciones, capturas y todos los informes.

- QA general: 230/230, `docs/QA/run-2026-09-05T19-15-15-447Z/report.json`.
- Regresión visual/retorno/reposo: 28/28, `docs/QA/premium-regression-2026-09-05T19-14-22-655Z/report.json`.
- Variantes y fallbacks: 27/27, `docs/QA/performance-preservation/report.json`.
- Última comprobación tras build y precompress: `docs/QA/performance-delivery/report.json`, sin errores, escritorio 1440×900 y móvil 390×844.
- Los primeros 25 fallos del QA general fueron un defecto de la prueba de ocultar el canvas durante su transición CSS de 650 ms. Se corrigió la prueba, conservando la transición de producción y los umbrales. El informe fallido se conserva como evidencia.
- Herramienta disponible usada: Puppeteer con Chrome instalado; no se encontró Playwright MCP entre las herramientas expuestas en esta sesión.
- Copia previa a optimizar: `backups/performance-20260905/`, incluye fuentes originales y `dist-lab/` congelado. El servidor comparativo temporal en 4175 se perderá con el reinicio; no es necesario arrancarlo para usar Kineti.

Variantes originales opcionales: `?grain=1`, `?fx=rgb`, `?hover=1`, `?idle=1`. Perfil de arranque opcional: `?profile=1`. No cambiar el acabado ni reiniciar la comparación de motores por defecto.

Frase para retomar: **«Retoma Kineti en C:\Users\fsala\Documents\GitHub\kinetiba-hero-3d; lee AGENTS.md y docs/SESSION_STATE.md, y vuelve a levantar la web para verla en el celular».**
