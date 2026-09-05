# Contexto del proyecto Kineti: evidencia local

Nota interna para orientar la narrativa y el diseño. Revisión estática del 4 de septiembre de 2026. No es una verificación del despliegue del Mac ni una auditoría de datos productivos. No se ejecutaron modelos, consultas contra servicios, pruebas ni procesos de sincronización.

La evidencia local respalda una arquitectura que conecta datos operativos, aplica reglas de negocio explícitas y entrega métricas a herramientas que puede consultar un analista de IA. Hay funciones implementadas de ventas, margen, inventario, cobranza, comparación de periodos y exportación. La copia revisada no acredita por sí sola una flota de agentes especialistas ni acciones operativas autónomas.

## Copias encontradas y alcance

| Copia | Estado observado | Qué permite afirmar |
| --- | --- | --- |
| `Documents/GitHub/kineti-ba` | HEAD `6986897`, 20 de marzo de 2026; árbol local con cambios y archivos adicionales | Código de extracción, ingesta, materialización de métricas, dashboard y un analista de IA. |
| `Documents/GitHub/mcp-erp-mx` | HEAD `52b61fb`, 14 de mayo de 2026 | Documentación y código relacionados con Kineti Copilot. Es una copia distinta. |
| `Documents/GitHub/mcp-erp-mx-worktrees/dbf-incremental` | HEAD `3e98d41`, 26 de agosto de 2026; dos documentos de planificación del 27 de agosto sin seguimiento | Implementación relacionada más reciente: vistas SQL, herramientas de consulta, controles de entrada, exportación y feedback humano. |
| Proyecto del Mac mini | Sin acceso autenticado en esta revisión | No se ha identificado su ruta, repositorio, rama, versión o implementación vigente. No se debe equiparar con ninguna copia anterior. |

La búsqueda de referencias a Odoo en documentación y código de `kineti-ba` encontró menciones comparativas en investigación de dashboards y especificaciones. No se localizó un adaptador Odoo implementado dentro del alcance inspeccionado. Esto no demuestra que el proyecto mencionado por el usuario no exista: puede estar en el Mac, en otro repositorio o en una versión posterior.

## Arquitectura respaldada por código

### Kineti BA

```text
Archivos de origen
  → extracción sin transformar las reglas de negocio
  → cola local persistente y reintentos
  → validación estructural e ingesta con control de duplicados
  → consultas y materialización
  → resultados para dashboard + almacén de métricas
  → herramientas de consulta
  → respuesta del analista de IA
```

- **Conservar el origen.** [extractor.py](../../kineti-ba/agent/src/extractor.py), líneas 19 y 123, extrae registros DBF y convierte tipos para transporte; separa esa labor de las transformaciones de negocio.
- **Tolerar interrupciones.** [batch_queue.py](../../kineti-ba/agent/src/batch_queue.py), líneas 18, 68, 130 y 195, mantiene una cola SQLite con WAL, estados y reintentos.
- **Validar el contrato de entrada.** [bulk_ingest/handler.py](../../kineti-ba/lambda/bulk_ingest/handler.py), línea 107, comprueba campos requeridos, identificador de empresa, entidad permitida, lista y claves de origen. Es validación estructural; no certifica la corrección económica de cada dato.
- **Controlar duplicados y fallos.** [transform/processor.py](../../kineti-ba/lambda/transform/processor.py), líneas 68, 100 y 120, inserta registros con conflicto controlado, revierte transacciones fallidas y registra el estado del lote. La ruta de ingesta masiva usa una clave de origen por entidad y empresa.
- **Separar cálculo y explicación.** [materializer/handler.py](../../kineti-ba/lambda/materializer/handler.py), líneas 213 y 348, obtiene métricas de resultados materializados y escribe el almacén de métricas. [metric_store.py](../../kineti-ba/lambda/materializer/metric_store.py), líneas 16 y 26, mantiene valores mediante UPSERT por empresa, métrica, periodo y dimensiones.
- **Dar herramientas definidas a la IA.** [ai_agent/agent.py](../../kineti-ba/lambda/ai_agent/agent.py), líneas 35, 69 y 103, implementa un analista con un bucle acotado y cuatro herramientas: obtener una métrica, comparar periodos, consultar una dimensión y listar alertas. [ai_agent/tools.py](../../kineti-ba/lambda/ai_agent/tools.py), líneas 39, 73, 111 y 144, consulta métricas con filtros por empresa.

El directorio `agent/` de esta copia contiene un **agente de extracción y sincronización**. Su presencia no demuestra por sí misma otro agente de IA.

### Kineti Copilot, copia de agosto

```text
Datos locales
  → vistas SQL con reglas de negocio
  → herramientas con parámetros y catálogo de vistas permitido
  → resultados numéricos y resúmenes preparados
  → explicación del modelo / archivo exportado
  → registro de la consulta y evaluación humana
```

La [guía del repositorio](../../mcp-erp-mx-worktrees/dbf-incremental/CLAUDE.md) describe la separación entre reglas en SQL y contratos de herramientas en Python. El código inspeccionado aporta:

| Capacidad | Evidencia de implementación |
| --- | --- |
| Consulta de la base en modo de solo lectura | [server.py](../../mcp-erp-mx-worktrees/dbf-incremental/src/mcp_erp_mx/server.py), línea 30: conexión DuckDB con `read_only=True`. |
| Catálogo definido de vistas y filtros | [view_whitelist.py](../../mcp-erp-mx-worktrees/dbf-incremental/src/mcp_erp_mx/view_whitelist.py): vistas y columnas permitidas, validación de identificadores y límite de filas. |
| Consulta parametrizada con comprobaciones | [server.py](../../mcp-erp-mx-worktrees/dbf-incremental/src/mcp_erp_mx/server.py), línea 2072: `consultar_view` verifica vista y columnas, limita resultados y parametriza valores. |
| Cálculos fuera de la generación de lenguaje | [00_core.sql](../../mcp-erp-mx-worktrees/dbf-incremental/sql/views/00_core.sql), líneas 80–84: subtotal, costo y margen; herramientas de [server.py](../../mcp-erp-mx-worktrees/dbf-incremental/src/mcp_erp_mx/server.py) devuelven valores y resúmenes calculados. |
| Bloqueo de una ambigüedad conocida | [server.py](../../mcp-erp-mx-worktrees/dbf-incremental/src/mcp_erp_mx/server.py), línea 142 y llamadas en 268, 1799 y 1853: bloquea determinadas métricas cuando encuentra estados de cancelación de notas de crédito sin clasificar. |
| Exportación de resultados | [server.py](../../mcp-erp-mx-worktrees/dbf-incremental/src/mcp_erp_mx/server.py), línea 2170: `export_view` genera un archivo y devuelve su ruta mediante un contrato de salida. No equivale a modificar la operación del negocio. |
| Registro y revisión humana | [model_ui.py](../../mcp-erp-mx-worktrees/dbf-incremental/scripts/model_ui.py), líneas 83–104 y 670: registro SQLite de consultas, herramientas, respuesta, tiempo, error y feedback OK/FAIL. Se verificó el código; no se abrieron conversaciones ni bases de registro. |

Funciones concretas presentes en el servidor: ventas brutas y netas, comparación de periodos, margen por categoría, productos de baja rotación, inventario crítico, concentración de cobranza y antigüedad de saldos. Son ejemplos del código local; no una lista de funciones confirmadas en el Mac.

## Qué significa aquí una base determinista

La lógica de cálculo está expresada en código y SQL, con campos, filtros y parámetros definidos. Dados los mismos datos, reglas, parámetros y referencia temporal, estos cálculos son reproducibles. La respuesta redactada por un modelo no adquiere esa propiedad automáticamente.

Un ejemplo útil para explicar el producto: calcular el margen con el costo histórico de la venta, distinguirlo del costo actual del inventario y evitar convertir dos veces una moneda. La [documentación de reglas](../../kineti-ba/docs/technical/BUSINESS_RULES.md), versión 3.3, explica esa distinción; la copia de agosto contiene fórmulas correspondientes en SQL. Los volúmenes de auditoría citados en documentación histórica no se volvieron a verificar en esta revisión.

Otro ejemplo implementado es detener una métrica cuando aparece un estado de cancelación desconocido. Esta conducta permite hablar de **reglas que detectan ambigüedades**, sin prometer que todo dato entrante sea correcto.

## Límites relevantes para la narrativa

1. **Agentes especialistas.** El [plan de arquitectura de agentes](../../mcp-erp-mx-worktrees/dbf-incremental/docs/plans/AGENT_ARCHITECTURE_PLAN.md), línea 8, está marcado como cancelado el 7 de mayo de 2026; dice que no fue necesario construir los seis skills y tres agentes propuestos. No debe presentarse ese plan como producto implementado. La copia de marzo muestra un analista y herramientas especializadas. El proyecto actual del Mac puede ser distinto; todavía no se comprobó.
2. **Acciones coordinadas.** Se observaron consultas, análisis, alertas en código y exportación de resultados. No se verificó un flujo de acciones operativas autónomas con aprobaciones humanas. Si se usa ese lenguaje, debe describir un servicio o dirección del producto confirmado por el usuario, sin atribuirlo a esta evidencia.
3. **Gobernanza.** Hay controles concretos de consulta y feedback. No se realizó una auditoría integral de permisos. En el analista de marzo, `role` entra en `run_agent` pero no se propaga al despachador de herramientas; las instrucciones del prompt sobre información sensible no prueban por sí mismas control de acceso.
4. **Actualización y consistencia.** La escritura al almacén de métricas de marzo es `best-effort`: su fallo se registra y no detiene la materialización. No se puede prometer sincronía perfecta entre dashboard y analista. `previous_value` es el valor anterior de una materialización del mismo periodo; no equivale siempre al periodo calendario anterior.
5. **Revisión humana.** El feedback OK/FAIL implementado es evaluación de respuestas. No acredita aprobación previa de decisiones, segregación de funciones ni trazabilidad de cada transformación.
6. **Despliegue.** Tener código y pruebas en disco no demuestra ejecución exitosa, adopción ni disponibilidad productiva. La guía del worktree advierte además que las vistas productivas son copias promovidas mediante un script y no necesariamente las del árbol de trabajo.
7. **Privacidad absoluta.** No se validó dónde ejecuta cada modelo ni qué configuración está activa. No afirmar que ningún dato puede salir de la red a partir de la documentación de una variante local.

## Acceso existente al Mac

El agente principal comunicó que Tailscale identifica un Mac mini en línea en `100.99.135.70`, nombre `alfreds-mac-mini-1.tailfbd6cc.ts.net`. También informó que los intentos SSH ya realizados con `fsala` y `alfredmacmini` fueron rechazados. Esta revisión no hizo intentos adicionales.

La configuración legible `C:/Users/fsala/.ssh/config` solo contiene un bloque para GitHub; no se encontró alias, usuario o salto configurado para ese Mac. Se leyeron directivas de conexión, sin abrir claves privadas.

El [README de instalación para Mac mini](../../mcp-erp-mx-worktrees/dbf-incremental/installer/mac-mini-lalo/README.md), líneas 36 y 92, supone un clon bajo `~/services/` e indica reemplazar `/Users/alfredmacmini` por el directorio personal correspondiente. Esa ruta es una plantilla, no prueba de un usuario SSH válido. La [guía de uso](../../mcp-erp-mx-worktrees/dbf-incremental/docs/USAGE_GUIDE.md), línea 13, contiene un túnel hacia otro MacBook; no se debe trasladar su usuario o clave al Mac mini actual.

Sigue pendiente una configuración de acceso confirmada por el usuario y la ubicación del proyecto en el Mac. No se abrieron archivos de secretos, claves privadas, variables de entorno, historiales generales, bases de conversaciones ni contenido de datos de clientes.

## Traducción a lenguaje público

La idea propuesta **«Tu información. En movimiento.»** es compatible con las capacidades observadas y permite representar el paso de datos dispersos a una lectura útil del negocio.

Una bajada sustentada por la copia revisada:

> Conectamos los datos de tu operación con reglas claras e IA para convertir información verificable en decisiones con contexto.

Alternativa más directa:

> De tus datos a una visión clara de tu negocio. Métricas verificables e IA para entender qué cambia y decidir dónde actuar.

Para las secciones, sin convertir cada pieza visual en una promesa de un agente independiente:

| Sección | Texto posible | Sustento |
| --- | --- | --- |
| Conecta tus fuentes | Reúne la información de tu operación y conserva su origen. | Extracción e ingesta estructurada. |
| Da sentido a tus datos | Aplica reglas de negocio explícitas para obtener métricas comparables. | SQL, reglas de costo, filtros, periodos y materialización. |
| Explora con IA | Haz preguntas sobre ventas, margen, inventario y cobranza con herramientas conectadas a tus métricas. | Herramientas y analista implementados. |
| Decide con contexto | Compara periodos, detecta cambios y revisa las respuestas antes de actuar. | Comparativos, métricas operativas y feedback humano. |

**«Agentes de IA sobre una base determinista»** puede expresar una oferta más amplia si el usuario confirma esa arquitectura en su producto actual. Para describir estrictamente lo encontrado aquí, la formulación más precisa es **«IA conectada a métricas y reglas de negocio definidas»**.

El beneficio estratégico se plantea como propósito —entender el negocio y decidir dónde actuar— sin prometer una mejora cuantificada, retorno garantizado o automatización no verificada. Los ejemplos públicos deben usar datos sintéticos y omitir nombres, importes y otros datos reales de clientes.
