# Antojados Contract Navigation Map V1

Fecha: 2026-06-17

## 1. Documento principal

```text
api/docs/contracts/ENGINE_SHARED_CONSUMPTION_CONTRACT_V1.md
```

## 2. Contrato obligatorio Fase 0

```text
api/docs/contracts/ANTOJADOS_MEDIA_ENGINE_PHASE0_DB_OWNERSHIP_CONTRACT_V1.md
```

Define:

- Que tablas se quedan en Antojados.
- Que tablas son responsabilidad de EngineShared.
- Como opera fallback legacy.
- Como se registra el retorno procesado.
- Que SPs son obligatorios.

## 3. Contrato servicios sponsor

```text
api/docs/contracts/ANTOJADOS_SPONSOR_SERVICES_MASTER_AGREEMENT_DRAFT_V1.md
api/docs/contracts/SPONSOR_SERVICES_ANNEX_MODEL_V1.md
```

Define:

- Contrato marco entre AntojadosMx y sponsors.
- Servicios disponibles sin precios.
- Beneficios por suscripcion.
- Reglas de Vas Ir, Los Chidos, Arre y tiles.
- Servicios futuros por anexos.
- Protecciones legales y operativas para Antojados.

## 4. Siguiente lectura

- Para API y jobs del engine: `..\..\..\Atlx_EngineShared\docs\contracts\ENGINE_SHARED_API_CONTRACT_V1.md`
- Para ownership/return mode del engine: `..\..\..\Atlx_EngineShared\docs\contracts\ENGINE_SHARED_INTEGRATION_OWNERSHIP_CONTRACT_V1.md`
- Para adapter Antojados: `..\..\..\Atlx_EngineShared\docs\contracts\ANTOJADOS_ADAPTER_CONTRACT_V1.md`
- Para publicaciones originadas desde Explorer: `..\..\..\Atlx_ExplorerApp\contracts\integration\EXPLORER_ENGINE_ANTOJADOS_INTEGRATION_CONTRACT_V1.md`

## 5. Regla final

Antojados registra en sus tablas solo cuando el entregable ya fue procesado por EngineShared o por el adapter legacy temporal.
