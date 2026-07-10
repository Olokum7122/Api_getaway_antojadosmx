# AntojadosMx - Modelo de Anexos de Servicios Sponsor V1

Estado: borrador operativo  
No incluye precios  
Fecha: 2026-06-18

## 1. Uso del anexo

Cada servicio sponsor debe activarse por anexo u orden de servicio. El contrato marco protege la relacion general; el anexo define el servicio concreto.

Estructura recomendada:

```text
Contrato Marco
  -> Anexo A: Suscripcion Base Vas Ir + Los Chidos
  -> Anexo B: Arre
  -> Anexo C: Tiles
  -> Anexo D: Inteligencia y metricas avanzadas
  -> Anexo E: No Vas Ir? / Delivery
  -> Anexo F: Arre Premium
  -> Anexo G: Venta de boletos
```

## 2. Campos obligatorios por anexo

Todo anexo debe declarar:

- Nombre del servicio.
- Canal tecnico si aplica.
- Beneficios incluidos.
- Exclusiones.
- Vigencia.
- Reglas de contenido.
- Reglas de moderacion.
- Metricas disponibles.
- Responsabilidades del SPONSOR.
- Responsabilidades de ANTOJADOS.
- Causas de suspension.
- Dependencias tecnicas.
- Politica de cambios.
- Referencia a precio externo, sin describir precio en el contrato marco.

## 3. Anexo A - Suscripcion Base: Vas Ir + Los Chidos

### Servicio

La suscripcion base habilita al SPONSOR para operar presencia comercial en `Vas Ir` y consultar desempeno basico asociado a `Los Chidos`, conforme a disponibilidad tecnica y reglas de AntojadosMx.

### Beneficios

- Publicar contenido general del negocio.
- Publicar platillos o novedades.
- Publicar promociones.
- Publicar descuentos.
- Mostrar contenido de local, clientes o promocionales permitidos.
- Consultar metricas basicas.
- Consultar desempeno relativo o posicion cuando aplique.

### Canal tecnico

```text
channel = vas_ir
publication_type = general | promo | discount | new_dish
```

### Exclusiones

- No incluye eventos Arre.
- No incluye compra de tiles.
- No incluye posicion garantizada en Los Chidos.
- No incluye inteligencia avanzada.
- No incluye delivery.
- No incluye venta de boletos.

### Protecciones especificas

ANTOJADOS podra limitar, pausar, rechazar o retirar publicaciones que no correspondan al canal, que sean enganosas, que incumplan reglas de contenido o que afecten la experiencia de usuarios.

Los Chidos no es un espacio comprado de posicionamiento fijo; es un componente de ranking sujeto a reglas, datos y rendimiento.

## 4. Anexo B - Arre

### Servicio

Arre habilita al SPONSOR para publicar eventos dentro de AntojadosMx.

### Beneficios

- Publicar eventos.
- Exposicion inicial de siete dias.
- Posibilidad de incrementar tiempo de exposicion mediante orden adicional.
- Mostrar datos del evento, imagen, descripcion, fecha, horario y ubicacion.

### Canal tecnico

```text
channel = arre
publication_type = event
```

### Eventos permitidos

- Musica en vivo.
- DJ nights.
- Noches tematicas.
- Presentaciones.
- Experiencias presenciales.

### Exclusiones

- No incluye venta de boletos salvo anexo especifico.
- No incluye permisos ni licencias del evento.
- No incluye seguridad, operacion, staff o logistica.
- No garantiza asistencia.
- No garantiza venta o reservacion.

### Responsabilidad del SPONSOR

El SPONSOR debe contar con permisos, autorizaciones, derechos musicales, uso de imagen, seguridad, capacidad del establecimiento y cualquier requisito aplicable al evento.

## 5. Anexo C - Compra de Tiles

### Servicio

El SPONSOR puede adquirir tiles de marca para exposicion en placements disponibles dentro de AntojadosMx.

### Beneficios

- Exposicion visual de marca.
- Uso de logo, icono o elemento visual autorizado.
- Distribucion en pantallas o feeds disponibles segun modalidad.
- Revision y aprobacion operativa.

### Reglas de contenido

Los tiles solo pueden contener contenido de marca. No pueden contener:

- Precios.
- Descuentos.
- Promociones.
- Llamados directos a compra.
- Mensajes enganosos.
- Comparaciones denigratorias.
- Contenido ofensivo.
- Contenido regulado sin autorizacion.

### Estados

```text
pending_review
approved
rejected
disabled
paused
```

### Exclusiones

- No garantiza clicks.
- No garantiza conversion.
- No garantiza aparicion continua.
- No garantiza exclusividad de pantalla.

## 6. Anexo D - Inteligencia y metricas avanzadas

### Servicio futuro

Reportes avanzados sobre actividad, rendimiento, publicaciones, tiles, eventos, tendencias y recomendaciones.

### Beneficios posibles

- Reportes de desempeno.
- Tendencias por ciudad.
- Comparativos de categoria.
- Rendimiento de tiles.
- Rendimiento de Arre.
- Recomendaciones operativas.

### Proteccion

Las metricas son informativas. No equivalen a auditoria financiera, garantia de ventas, garantia de trafico ni certificacion de mercado.

## 7. Anexo E - No Vas Ir? / Delivery

### Servicio futuro

Componente de delivery asociado al negocio del SPONSOR.

### Beneficios posibles

- Catalogo.
- Productos.
- Pedidos.
- Carrito.
- Administracion basica.
- Disponibilidad por zona.

### Responsabilidad del SPONSOR

El SPONSOR sera responsable de producto, calidad, inocuidad, precios, disponibilidad, tiempos, empaques, atencion, reembolsos e incidencias atribuibles a su negocio, salvo que otro anexo establezca una operacion distinta.

## 8. Anexo F - Arre Premium

### Servicio futuro

Formato especial para conciertos masivos, eventos premium o exposicion destacada.

### Requisitos posibles

- Validacion previa.
- Permisos.
- Licencias.
- Seguridad.
- Derechos de musica.
- Derechos de imagen.
- Capacidad del recinto.
- Reglas especiales de cancelacion.

## 9. Anexo G - Venta de boletos

### Servicio futuro

Venta, reserva, control o validacion de boletos dentro de la app.

### Elementos obligatorios futuros

- Titular del evento.
- Responsable de emision.
- Comisiones.
- Impuestos.
- Politica de cancelacion.
- Politica de reembolso.
- Contracargos.
- Fraude.
- Control de acceso.
- Soporte al comprador.

## 10. Reglas de actualizacion

ANTOJADOS podra agregar nuevos anexos para servicios futuros. Cada nuevo anexo debe declarar beneficios, limites, responsabilidades, exclusiones y protecciones especificas.

