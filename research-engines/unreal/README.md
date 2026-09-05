# Kineti / Unreal Pixel Streaming 2

Prototipo funcional aislado: 27 piezas renderizadas por Unreal Engine 5.7.4, visibles como vídeo H.264 en el navegador y controladas desde la página. No usa ni modifica el proyecto MountainsUE.

Requisitos locales comprobados: UE 5.7.4 en `C:\Program Files\Epic Games\UE_5.7`, Visual Studio Build Tools 2022, SDK Windows, GPU RTX 5080, Node y las dependencias ya instaladas en el repositorio padre. No requiere una cuenta de nube ni dependencias nuevas de npm.

Desde PowerShell en esta carpeta:

```powershell
.\start.ps1 -Build
```

Abrir [http://127.0.0.1:8899](http://127.0.0.1:8899). El proyecto tarda unos segundos en inicializar el renderer. El editor se ejecuta como juego con `-RenderOffscreen`; no se abre una ventana del editor. `start.ps1` guarda exclusivamente sus propios PID en `runtime-pids.json`.

```powershell
node .\qa.mjs
.\stop.ps1
```

La parada comprueba que los PID siguen perteneciendo a esta carpeta antes de detenerlos. Los puertos HTTP/player 8899 y streamer 8898 escuchan únicamente en `127.0.0.1`.

## Controles

La página ofrece progreso reversible `0..1`, separación, selección `0..26`, altura de la pieza seleccionada y campo de visión. El scroll nativo controla progreso. JavaScript envía un JSON `UIInteraction`; C++ aplica el estado y devuelve un `Response` con 27 piezas, progreso, secuencia, coordenadas de la pieza seleccionada y otra pieza de control. El panel muestra el ACK recibido del motor, no un estado simulado en el navegador.

`window.__UNREAL_PROBE__` expone `setControls`, `setProgress`, `getState`, `getStats` y `getAcknowledgements` para las comprobaciones. `getState().ack` proviene de Unreal. Las estadísticas de vídeo proceden de `RTCPeerConnection.getStats()` y `requestVideoFrameCallback`.

## Evidencia y límites

La última ejecución se registra en [qa-report.json](evidence/qa-report.json). Guarda 12 comprobaciones funcionales, ACK, WebRTC y capturas. [Panel completo](evidence/unreal-browser-controls.png), [cubo](evidence/unreal-assembled.png), [pieza individual](evidence/unreal-one-piece.png), [separación](evidence/unreal-exploded.png), [progreso intermedio](evidence/unreal-progress-050.png), [progreso final](evidence/unreal-progress-100.png), [restauración](evidence/unreal-restored.png).

El tiempo de ACK mide JavaScript → estado de Unreal → respuesta; excluye codificar/transportar/mostrar el nuevo fotograma. No es input-to-pixel. La prueba usa loopback y una sola GPU compartida con otros trabajos; sus fps no constituyen un benchmark comparativo.

Se usan cubos/material básico del engine, suelo y dos luces; no hay paridad de assets, HDR, glifos, bevels o coreografía con los otros prototipos. No se ha construido un paquete final de distribución ni probado Internet, TURN, autenticación, móviles o sesiones independientes. Varios navegadores conectados comparten la misma escena.

`server.mjs` es una señalización mínima propia basada en el [protocolo oficial UE5.7](https://github.com/EpicGames/PixelStreamingInfrastructure/blob/UE5.7/Common/docs/messages.md), con `ws` del repositorio padre. El renderer, WebRTC y codificación del lado Unreal utilizan el plugin PixelStreaming2 oficial instalado. La señalización de esta prueba no pretende sustituir la infraestructura de producción de Epic.

Ver [ENGINE_OPTIONS.md](../../docs/ENGINE_OPTIONS.md) para inventario de Unity/Godot/Blender, fuentes actuales y distinción entre motores, runtimes, autoría y coordinación del scroll.
