# QA de Kineti

Ejecutar con el servidor local preparado:

```powershell
node scripts/qa-kineti.mjs
```

El script usa Puppeteer y busca Chrome o Edge ya instalados. No descarga navegadores ni usa `--disable-gpu`. Variables opcionales: `KINETI_QA_URL` (por defecto `http://127.0.0.1:5173`), `KINETI_QA_OUTPUT`, `PUPPETEER_EXECUTABLE_PATH` o `CHROME_PATH` para un ejecutable existente.

Cada ejecución genera `docs/QA/run-<fecha>/report.json`, capturas y los archivos descargados por el diálogo. El código de salida es `1` si falla una comprobación. El informe conserva errores de consola, excepciones, respuestas HTTP fallidas y peticiones fallidas; los warnings quedan registrados. Revisar el backend efectivo del informe: iniciar Chromium con GPU habilitada no garantiza WebGPU ni aceleración física.

## Comprobaciones

- Render por defecto y WebGL2 forzado con `?renderer=webgl`; escritorio de 1440×900, DPR 1.
- Scroll nativo a `0, .23, .40, .56, .74, 1`, navegación por clic y teclado, regreso a composiciones anteriores y resize de la misma página a 390×844 y de vuelta.
- Diagnósticos de 27 piezas del cubo, campo de 432 piezas en escritorio y al menos 162 en móvil, draw calls y triángulos positivos.
- Capturas reales del canvas con UI temporalmente oculta, comparadas contra el mismo fondo con canvas transparente. La varianza y la diferencia de píxeles evitan aceptar como 3D un fondo vacío. Las capturas normales conservan la composición completa para revisión humana.
- Contacto: nombres accesibles, etiquetas de campos, foco inicial y atrapado, Escape, retorno de foco y botón de cierre. Copia real al portapapeles y descarga real de un archivo con el texto de prueba. No se envían mensajes ni formularios a terceros.
- Preferencia del sistema de movimiento reducido, estabilidad de la imagen en reposo, cambio manual de preferencia y acceso al contenido final.

## Contrato de la página

`window.__KINETI__` debe ofrecer `ready`, `backend`, `progress`, `phase`, `cubePieces`, `tileCount`, `activeTiles`, `drawCalls`, `triangles` y diagnósticos opcionales adicionales. El script agrega posiciones reales de scroll al registro. Progreso es `scrollY / (document.documentElement.scrollHeight - innerHeight)`. No usa un método de salto del motor.

Selectores: canvas `data-testid="kineti-canvas"`, navegación `data-testid="phase-nav"` con botones `data-progress`, y controles `contact-open`, `contact-copy`, `contact-download`, `contact-close`, `motion-toggle`. El toggle expresa movimiento reducido con `aria-pressed="true"`. El contacto debe exponer un diálogo modal accesible con input de nombre, correo opcional y textarea.

## Límites de la evidencia

Una captura con píxeles distintos del fondo comprueba render visible, pero no la calidad artística ni que cada pieza sea legible. Revisar las seis composiciones, las transiciones, recortes en móvil, contraste del texto y cualquier sombreado defectuoso. Los umbrales de imagen son detectores de regresión amplia y permiten animación ambiental; no prueban igualdad matemática de todos los frames.

Un viewport móvil en Chrome de escritorio no valida Safari, GPU móvil, temperatura, batería o red real. El informe funcional tampoco es un benchmark comparativo: comprobar builds de producción, carga en frío, perfiles CPU/GPU y teléfonos físicos por separado. La metodología para decidir entre motores está en [RENDERER_DECISION.md](../RENDERER_DECISION.md).

Estado al preparar este documento: script verificado con `node --check`; ejecución de navegador pendiente de que la nueva escena esté lista. Cada `report.json` posterior describe únicamente esa ejecución y su entorno.
