# Antojados + MediaEngine Phase 0 DB Ownership Contract V1

Fecha: 2026-06-17  
Proyectos: AntojadosMx_v1_2, Atlx_EngineShared  
Estado: fuente canonica draft

## 1. Objetivo

Definir exactamente que conserva Antojados, que mueve su responsabilidad a MediaEngine y como debe operar la transicion sin romper Desma, Pachanga ni Business.

## 2. Decision principal

Antojados deja de ser el procesador principal de media. Antojados sigue siendo dueño del feed, posts, business posts y registros de media publicada.

```text
EngineShared procesa.
Antojados publica.
Antojados conserva el registro de lo publicado.
EngineShared conserva el registro tecnico de procesamiento.
```

## 3. Flujo actual legacy

```text
Antojados API
  -> mediaResolver
  -> mediaProcessor Sharp/FFmpeg
  -> mediaIntakeWorker
  -> antojados_core.soc_media_intake
  -> antojados_core.soc_media_assets / biz_media_assets
  -> antojados_core.soc_post_media / biz_post_media
```

Este flujo queda como fallback temporal.

## 4. Flujo objetivo Fase 0

```text
Antojados API
  -> engineSharedClient
  -> Atlx_EngineShared API
  -> ATLX_MEDIA_ENGINE.media_core
  -> render/result callback
  -> Antojados API
  -> ATLX_ANTOJADOS_APP.antojados_core SPs
  -> feed/business tables
```

Regla:

```text
Si ENGINE_SHARED_BASE_URL existe, Antojados intenta EngineShared.
Si EngineShared no esta configurado o falla segun politica, Antojados usa fallback legacy.
```

## 5. Tablas que permanecen en Antojados

Estas tablas pertenecen al dominio Antojados y no migran a EngineShared.

### Social/feed

```text
antojados_core.soc_posts
antojados_core.soc_post_media
```

Uso:

- Publicaciones sociales.
- Feed type: desma, pachanga, momentos, neta.
- Orden de media publicada.
- URLs publicables retornadas por EngineShared.

### Business

```text
antojados_core.biz_posts
antojados_core.biz_post_media
```

Uso:

- Publicaciones de negocio/sponsor.
- Canales vas_ir, arre.
- Media ya lista para publicar.

### Asset espejo/publicado

```text
antojados_core.soc_media_assets
antojados_core.biz_media_assets
```

Uso:

- Registro local Antojados de media ya procesada/publicable.
- Referencia al post o business post.
- URLs finales: thumb, feed, full, video_720, video_1080 cuando existan.
- Compatibilidad con queries/feed actual.

Regla:

```text
Estas tablas no son la fuente tecnica del procesamiento nuevo; son espejo de consumo/publicacion Antojados.
```

## 6. Tabla legacy que no debe crecer como core nuevo

```text
antojados_core.soc_media_intake
```

Estado:

- Se mantiene temporalmente para compatibilidad.
- No debe ser el intake principal de contratos nuevos.
- Puede usarse solo en fallback legacy.

Responsabilidad nueva equivalente en MediaEngine:

```text
media_core.upload_sessions
media_core.media_assets
media_core.media_jobs
```

## 7. Tablas que son responsabilidad de EngineShared

DB recomendada:

```text
ATLX_MEDIA_ENGINE
```

Schema:

```text
media_core
```

Tablas:

```text
media_core.upload_sessions
media_core.media_assets
media_core.media_quality_reports
media_core.media_jobs
media_core.media_renders
media_core.media_presets
media_core.media_publication_attempts
media_core.integration_events
```

Responsabilidad:

- Upload tecnico.
- Registro del original.
- Analisis de calidad.
- Procesamiento Sharp/FFmpeg.
- Jobs/retries/progreso.
- Renders por preset.
- Delivery status al consumidor.

## 8. Tabla a tabla: decision de ownership

| Tabla actual/nueva | Sistema dueño | Decision Fase 0 | Uso |
| --- | --- | --- | --- |
| `antojados_core.soc_posts` | Antojados | Se queda | Feed social |
| `antojados_core.soc_post_media` | Antojados | Se queda | Media adjunta a post |
| `antojados_core.biz_posts` | Antojados | Se queda | Feed business |
| `antojados_core.biz_post_media` | Antojados | Se queda | Media business adjunta |
| `antojados_core.soc_media_assets` | Antojados | Se queda como espejo | Media publicada social |
| `antojados_core.biz_media_assets` | Antojados | Se queda como espejo | Media publicada business |
| `antojados_core.soc_media_intake` | Antojados legacy | No crecer como core | Fallback temporal |
| `media_core.upload_sessions` | EngineShared | Nuevo core | Intake/upload real |
| `media_core.media_assets` | EngineShared | Nuevo core | Original/asset tecnico |
| `media_core.media_quality_reports` | EngineShared | Nuevo core | Calidad |
| `media_core.media_jobs` | EngineShared | Nuevo core | Processing queue |
| `media_core.media_renders` | EngineShared | Nuevo core | Renders finales |
| `media_core.media_presets` | EngineShared | Nuevo core | Formatos/presets |

## 9. SPs Antojados obligatorios

Antojados debe persistir resultados mediante SPs:

```text
antojados_core.usp_publish_soc_post
antojados_core.sp_soc_post_media_attach
antojados_core.usp_publish_biz_post
antojados_core.sp_biz_post_media_attach
```

Recomendados para espejo de assets:

```text
antojados_core.usp_soc_media_asset_register
antojados_core.usp_biz_media_asset_register
```

Regla:

```text
No se agregan mutaciones nuevas con SQL directo en resolvers.
```

## 10. Contrato de retorno EngineShared -> Antojados

EngineShared retorna:

```json
{
  "consumer": {
    "system": "antojados",
    "return_mode": "antojados_feed"
  },
  "source_ref": {
    "user_id": "usr_123",
    "channel": "feed_post",
    "feed_type": "desma"
  },
  "media_asset_id": "ast_123",
  "quality_report_id": "qr_123",
  "renders": [
    {
      "render_id": "rnd_123",
      "preset_key": "antojados_desma_vertical",
      "media_type": "video",
      "public_url": "https://cdn/render.mp4",
      "thumb_url": "https://cdn/thumb.jpg",
      "feed_url": "https://cdn/render.mp4",
      "full_url": "https://cdn/render.mp4",
      "video_720_url": "https://cdn/render_720.mp4",
      "video_1080_url": "https://cdn/render_1080.mp4",
      "status": "ready"
    }
  ]
}
```

Antojados registra:

```text
soc_posts/soc_post_media/soc_media_assets
```

o:

```text
biz_posts/biz_post_media/biz_media_assets
```

segun `return_mode`.

## 11. Regla de migracion

Fase 0 no borra tablas ni rompe endpoints. Solo introduce el adapter:

```text
media.service.js
  -> engineSharedClient si configurado
  -> mediaResolver legacy si no configurado
```

Cuando Fase 1 este estable:

```text
soc_media_intake queda solo historica/legacy
EngineShared se vuelve default
fallback legacy se puede apagar por feature flag
```

## 12. Criterio de cierre Fase 0

Fase 0 esta cerrada cuando:

- Antojados puede procesar via EngineShared.
- Antojados puede caer a legacy local.
- Antojados persiste publicaciones con SPs.
- Antojados conserva sus tablas de feed.
- EngineShared conserva sus tablas tecnicas.
- No hay media renderizada sin registro consumidor.

