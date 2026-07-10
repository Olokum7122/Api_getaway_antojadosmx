# Antojados - EngineShared Consumption Contract V1

Estado: draft inicial  
Proyecto consumidor: AntojadosMx_v1_2  
Proveedor: Atlx_EngineShared

## Objetivo

Antojados debe consumir el motor compartido para procesar media sin ser el dueno del engine.

## Modelo de integracion propuesto

El proyecto busca tener un editor de media mas profesional para el programa Exploradores de Antojados, a partir de un motor mas completo.

Esto modifica el modelo de Antojados porque ahora quien procesa la media seria EngineShared y retorna a Antojados imagenes y videos ya procesados.

La separacion propuesta es:

```text
Engine procesa.
Antojados publica.
Explorer edita/orquesta.
```

Antojados debe saber de posts, usuarios, feed, negocio, interacciones y ranking. No debe cargar con FFmpeg, normalizacion de formatos, thumbnails, calidad, retries, renders ni procesamiento profesional de media.

EngineShared puede recibir archivos de distintos tipos y condiciones:

- Video raro.
- Foto gigante.
- HEIC.
- WebP.
- MP4 pesado.
- Rotacion rara.
- Metadata sucia.

Y debe devolver siempre contratos estables:

- `thumb_url`
- `feed_url`
- `full_url`
- `video_720_url`
- `video_1080_url`
- `aspect_ratio`
- `duration`
- `width`
- `height`
- `status`

Esto permite que los posts tengan una estructura mas estable. Hoy los posts pueden traer imagenes de todo tipo y formato; con EngineShared, Antojados solo publica media normalizada, validada y lista para feed.

El flujo ideal seria:

```text
Explorer / Antojados app
  -> Antojados API solicita upload/render al Engine
  -> Engine procesa y normaliza
  -> Engine devuelve media package listo
  -> Antojados crea post con estructura estable
  -> Feed consume solo formatos canonicos
```

El post sigue siendo de Antojados. Lo que cambia es que Antojados ya no crea/publica el contenido definitivo hasta que el engine entregue media lista.

Contrato objetivo de post con media procesada:

```json
{
  "post_id": "...",
  "user_id": "...",
  "feed_type": "desma",
  "caption": "...",
  "media": [
    {
      "asset_id": "...",
      "media_type": "video",
      "thumb_url": "...",
      "feed_url": "...",
      "full_url": "...",
      "video_720_url": "...",
      "width": 1080,
      "height": 1920,
      "duration_sec": 15,
      "aspect_ratio": "9:16",
      "source": "engine_shared"
    }
  ]
}
```

Explorer no debe escribir directo en Antojados DB. Engine no debe decidir si algo va al feed. Engine entrega media tecnicamente correcta; Antojados decide publicacion, permisos, visibilidad y ranking.

Antojados conserva:

- Feed social.
- Posts.
- Business posts.
- Interacciones.
- Lugares.
- Assets publicados en sus tablas de dominio.

EngineShared conserva:

- Upload sessions.
- Assets fuente.
- Quality reports.
- Presets.
- Jobs.
- Renders.

## Flujo canonico

```text
Antojados client
  -> Antojados API
  -> EngineShared API
  -> render listo
  -> Antojados API
  -> Antojados SPs
  -> Antojados DB
```

## Compatibilidad temporal

Los endpoints actuales se mantienen como legacy:

- `POST /api/v1/antojados/media/upload`
- `GET /api/v1/antojados/media/intake/:intakeId`

Pero internamente deben migrar a EngineShared.

## Contrato de consumo desde Antojados API

### Crear upload session

Antojados llama:

```text
POST {ENGINE_SHARED_BASE_URL}/api/v1/media/upload-sessions
```

Payload:

```json
{
  "tenant_id": "antojados",
  "instance_id": "antojados-main",
  "user_id": "usr_123",
  "filename": "media.mp4",
  "mime_type": "video/mp4",
  "media_type": "video",
  "expected_size_bytes": 125000000
}
```

### Registrar asset

```text
POST {ENGINE_SHARED_BASE_URL}/api/v1/media/assets
```

### Render para Desma

```text
POST {ENGINE_SHARED_BASE_URL}/api/v1/media/jobs/render
```

Payload:

```json
{
  "media_asset_id": "ast_123",
  "preset_keys": ["antojados_desma_vertical"],
  "options": {
    "enhance": true,
    "safe_area": true
  }
}
```

### Render para Pachanga

Preset segun tipo:

- Foto: `antojados_pachanga_gallery_photo`
- Video: `antojados_pachanga_gallery_video`

## Escritura final en Antojados

Cuando los renders estan listos, Antojados API publica usando sus propios SPs:

- Social: `antojados_core.usp_publish_soc_post`
- Social media: `antojados_core.sp_soc_post_media_attach`
- Business: `antojados_core.usp_publish_biz_post`
- Business media: `antojados_core.sp_biz_post_media_attach`

## Variables de entorno requeridas

```text
ENGINE_SHARED_BASE_URL=http://localhost:4100
ENGINE_SHARED_API_KEY=...
ENGINE_SHARED_TIMEOUT_MS=30000
```

## Reglas

1. Antojados no procesa media profesional si EngineShared esta disponible.
2. Antojados no envia proyectos Explorer al feed.
3. Antojados no escribe en DB de EngineShared.
4. ExplorerApp no escribe directo en Antojados DB.
5. Antojados guarda solo el resultado publicable: URLs/render metadata/post media.
6. El contrato legacy base64 queda solo para compatibilidad temporal.

## Siguiente cambio tecnico recomendado

Crear `src/services/antojados/engineSharedClient.js` en Antojados API y adaptar `media.service.js` para:

- Usar EngineShared cuando `ENGINE_SHARED_BASE_URL` exista.
- Caer al motor legacy local cuando no exista.
- Mantener intacto el contrato actual de las apps publicadas.
