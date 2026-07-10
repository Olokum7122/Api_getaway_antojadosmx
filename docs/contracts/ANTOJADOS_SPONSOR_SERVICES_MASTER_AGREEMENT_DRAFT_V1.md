# AntojadosMx - Contrato Marco de Servicios para Sponsors V1

Estado: borrador legal-operativo  
Uso: base para revision legal antes de firma  
No incluye precios  
Fecha: 2026-06-18

> Nota: este documento es un borrador de trabajo. Debe ser revisado y adaptado por asesoria legal mexicana antes de usarse con clientes.

## 1. Partes

Celebran el presente Contrato Marco de Servicios, por una parte, el proveedor de la plataforma AntojadosMx, en adelante `ANTOJADOS`, y por otra parte la persona fisica o moral que contrata servicios de exposicion, publicacion, presencia comercial, ranking, eventos, tiles, inteligencia, delivery, boletaje u otros servicios disponibles en la aplicacion, en adelante el `SPONSOR`.

ANTOJADOS y el SPONSOR podran denominarse conjuntamente las `Partes`.

## 2. Objeto

El objeto del presente contrato es establecer los terminos bajo los cuales ANTOJADOS prestara al SPONSOR servicios digitales dentro de la app AntojadosMx, incluyendo componentes de publicacion, visibilidad, presencia comercial, ranking, eventos, tiles de marca, metricas y servicios futuros que se activen mediante anexos u ordenes de servicio.

El presente contrato no garantiza ventas, conversiones, posicionamiento organico, asistencia a eventos, resultados comerciales, trafico minimo ni permanencia en posiciones especificas de ranking, salvo que un anexo expresamente lo indique.

## 3. Estructura contractual

El contrato se integra por:

- Contrato Marco de Servicios.
- Anexo de Servicios Contratados.
- Anexo de Reglas de Contenido.
- Anexo de Privacidad y Datos.
- Ordenes de servicio, cotizaciones o aceptaciones digitales.
- Politicas operativas publicadas o notificadas por ANTOJADOS.

En caso de contradiccion, prevalecera el siguiente orden:

1. Anexo u orden de servicio especifica.
2. Contrato Marco.
3. Politicas operativas.
4. Material comercial o informativo.

## 4. Servicios disponibles

Los servicios disponibles podran activarse individualmente o en paquete, segun el anexo correspondiente. Este contrato no describe precios.

### 4.1 Suscripcion Base: Vas Ir + Los Chidos

La suscripcion base puede incluir acceso a los componentes `Vas Ir` y `Los Chidos`.

#### Vas Ir

Vas Ir permite al SPONSOR publicar contenido relacionado con su negocio dentro del canal comercial correspondiente. Los tipos de publicacion permitidos son:

- Platillos o nuevos productos del local.
- Descuentos.
- Promociones.
- Publicaciones generales del negocio.
- Contenido de su local.
- Contenido de sus clientes, siempre que cuente con autorizacion suficiente.
- Contenido promocional general del negocio permitido por ANTOJADOS.

Tipos tecnicos actuales:

```text
channel = vas_ir
publication_type = general | promo | discount | new_dish
```

#### Los Chidos

Los Chidos es un componente de ranking de ciudad donde aparecen negocios destacados de acuerdo con criterios operativos, actividad, rendimiento, interacciones, calidad de informacion, senales de uso y reglas internas de ANTOJADOS.

La suscripcion base puede permitir al SPONSOR consultar:

- Su posicion o desempeno relativo dentro del ranking, cuando aplique.
- Metricas basicas de su negocio.
- Indicadores generales de rendimiento.
- Comparativos o tendencias basicas, si se encuentran disponibles.

ANTOJADOS no garantiza una posicion determinada dentro de Los Chidos. El ranking puede cambiar por comportamiento de usuarios, disponibilidad de datos, calidad de contenido, actividad, reglas de moderacion, ubicacion, categoria, temporalidad y ajustes del algoritmo.

### 4.2 Suscripcion Arre

Arre es un componente para publicar eventos. Su uso esta limitado a contenido de eventos.

Ejemplos:

- Musica en vivo.
- Noches de DJ.
- Eventos tematicos.
- Presentaciones.
- Experiencias presenciales del negocio.

Tipo tecnico actual:

```text
channel = arre
publication_type = event
```

La suscripcion base de Arre contempla una exposicion inicial de siete dias. El SPONSOR podra contratar incrementos de tiempo de exposicion mediante anexo, orden de servicio o aceptacion digital.

ANTOJADOS no garantiza aforo, asistencia, ventas, reservaciones, consumo en sitio ni resultados economicos derivados del evento.

### 4.3 Compra de Tiles

Los tiles son espacios visuales de marca que pueden exponerse dentro de pantallas o feeds de la red social de AntojadosMx, segun disponibilidad, reglas de distribucion, revision y aprobacion.

Los tiles:

- Solo pueden mostrar contenido de marca.
- Pueden incluir logotipo, icono, identidad visual, elemento grafico o marca permitida.
- No deben contener publicidad directa, promociones, precios, descuentos, promesas comerciales o llamadas agresivas a la compra, salvo que ANTOJADOS habilite una modalidad distinta por escrito.
- Estan sujetos a revision, aprobacion, rechazo, pausa o deshabilitacion.

La compra de tiles puede variar segun pantalla, ubicacion, placement, duracion, cuota, disponibilidad o modalidad operativa. Este contrato no establece precios.

Estados operativos esperados:

```text
pending_review
approved
rejected
disabled
paused
```

ANTOJADOS podra rechazar o suspender tiles que incumplan reglas visuales, legales, de marca, tecnicas, de seguridad, de reputacion, de derechos de terceros o politicas internas.

## 5. Servicios futuros

Los siguientes servicios podran incorporarse posteriormente mediante anexos, sin necesidad de sustituir el presente contrato marco:

### 5.1 Inteligencia y metricas avanzadas

Servicio orientado a reportes, analitica, tendencias, rendimiento, comportamiento agregado, comparativos, desempeno de publicaciones, desempeno de tiles y recomendaciones operativas.

Las metricas podran ser estimaciones, agregados o datos procesados. ANTOJADOS no garantiza que las metricas representen ingresos, utilidad, ventas reales, aforo o resultados financieros del SPONSOR.

### 5.2 No Vas Ir? / Delivery

Componente futuro de delivery. Podra incluir catalogo, productos, carrito, pedidos, zonas, disponibilidad, costos logisticos, preparacion y reglas operativas.

Salvo que un anexo establezca lo contrario, el SPONSOR sera responsable de:

- Disponibilidad de productos.
- Calidad, inocuidad y preparacion.
- Tiempos ofrecidos.
- Precios publicados.
- Cumplimiento sanitario.
- Atencion al cliente.
- Reembolsos o incidencias atribuibles al negocio.

### 5.3 Arre Premium

Servicio futuro para eventos de mayor escala, conciertos masivos, exposicion destacada o formatos especiales.

Podra requerir:

- Permisos.
- Licencias.
- Autorizaciones.
- Derechos musicales o de imagen.
- Reglas de seguridad.
- Capacidad del venue.
- Responsabilidad del organizador.

### 5.4 Venta de boletos en la app

Servicio futuro para venta, reserva, control o validacion de boletos.

Podra requerir anexos especificos sobre:

- Emision de boletos.
- Comisiones.
- Cancelaciones.
- Reembolsos.
- Contracargos.
- Acceso.
- Fraude.
- Impuestos.
- Responsabilidad del organizador.

## 6. Alta, verificacion y expediente del sponsor

ANTOJADOS podra requerir al SPONSOR informacion de alta, identidad, negocio, representante, facturacion y documentos de expediente.

El SPONSOR declara que la informacion proporcionada es veraz, vigente y suficiente. ANTOJADOS podra suspender, limitar o rechazar servicios cuando la informacion sea incompleta, falsa, inconsistente, vencida o no verificable.

Informacion/documentacion esperada:

- Nombre comercial.
- Razon social, si aplica.
- RFC, si aplica.
- Domicilio fiscal, si aplica.
- Correo de facturacion.
- Datos de representante.
- Giro del negocio.
- Ciudad o zona de operacion.
- Documentos de expediente requeridos por ANTOJADOS.

## 7. Obligaciones de ANTOJADOS

ANTOJADOS se obliga a:

- Habilitar el acceso a los servicios contratados conforme al anexo aplicable.
- Mantener medios operativos razonables para publicacion, revision, moderacion y visualizacion.
- Aplicar reglas de contenido y moderacion de forma operativa.
- Poner a disposicion del SPONSOR las funciones contratadas, sujeto a disponibilidad tecnica.
- Proteger sus sistemas y datos conforme a practicas razonables y normativa aplicable.
- Informar, cuando corresponda, restricciones o suspensiones operativas relevantes.

## 8. Obligaciones del SPONSOR

El SPONSOR se obliga a:

- Usar la plataforma conforme a este contrato, anexos y politicas.
- Publicar solo contenido propio o autorizado.
- Responder por la veracidad de su informacion, promociones, eventos, descuentos, productos y servicios.
- Contar con derechos de uso sobre marcas, imagenes, videos, musica, logos, fotografias, textos y materiales publicados.
- No publicar contenido enganoso, ilicito, discriminatorio, ofensivo, fraudulento, invasivo, difamatorio, sexual explicito, violento, riesgoso, sanitario irregular o contrario a politicas de ANTOJADOS.
- Atender reclamaciones de sus clientes cuando deriven de productos, servicios, eventos, promociones, descuentos, delivery o boletos ofrecidos por el SPONSOR.
- Mantener actualizada su informacion comercial, fiscal y de contacto.
- Cumplir leyes aplicables a su giro, incluyendo permisos, licencias, normas sanitarias, fiscales, de publicidad, derechos de autor, uso de imagen, proteccion al consumidor y datos personales.

## 9. Contenido del sponsor

El SPONSOR conserva la titularidad de su contenido, pero otorga a ANTOJADOS una licencia no exclusiva, mundial, libre de regalias, sublicenciable en lo necesario, revocable al terminar el servicio salvo registros historicos, para alojar, procesar, adaptar tecnicamente, comprimir, mostrar, distribuir, comunicar publicamente y usar dicho contenido dentro de AntojadosMx y sistemas relacionados, exclusivamente para prestar los servicios contratados, operar la plataforma, generar reportes, moderar contenido, prevenir abuso y mantener evidencias operativas.

ANTOJADOS podra ajustar formatos, compresion, resolucion, miniaturas, recortes o variantes tecnicas del contenido para compatibilidad de pantallas, feeds, rendimiento o seguridad.

## 10. Moderacion, revision y suspension

ANTOJADOS podra revisar, aprobar, rechazar, pausar, ocultar, limitar o eliminar contenido cuando:

- Incumpla este contrato o politicas.
- Exista sospecha razonable de infraccion legal.
- Existan reclamaciones de terceros.
- Afecte la experiencia de usuarios.
- Afecte seguridad, reputacion o integridad de la plataforma.
- Sea incompatible con el formato contratado.
- Contenga informacion enganosa, no verificable o riesgosa.
- Promueva actividades prohibidas o reguladas sin autorizacion.

La aprobacion de contenido por ANTOJADOS no implica validacion legal, sanitaria, fiscal, comercial ni de derechos de terceros.

## 11. Ranking, metricas y desempeno

Los rankings, metricas, indicadores, reportes, posiciones, tendencias y desempenos mostrados en la app son herramientas informativas y operativas.

ANTOJADOS podra modificar algoritmos, ponderaciones, criterios, fuentes de datos, reglas de visualizacion y componentes de medicion sin que ello constituya incumplimiento, siempre que no elimine de forma injustificada un servicio contratado activo.

El SPONSOR reconoce que:

- Los Chidos no garantiza posicion.
- Vas Ir no garantiza ventas.
- Arre no garantiza asistencia.
- Tiles no garantizan conversion.
- Las metricas pueden variar por disponibilidad de datos.
- Las metricas basicas no sustituyen contabilidad, auditoria ni reportes financieros del SPONSOR.

## 12. Servicios sujetos a disponibilidad

Los servicios dependen de infraestructura, conectividad, tiendas de aplicaciones, dispositivos, servidores, proveedores externos, mantenimiento, actualizaciones, moderacion, seguridad y disponibilidad tecnica.

ANTOJADOS podra realizar mantenimiento, mejoras, cambios de interfaz, ajustes de algoritmos, cambios de placements, modificaciones tecnicas o migraciones sin requerir autorizacion previa del SPONSOR, siempre que preserve razonablemente el servicio contratado.

## 13. Pagos y vigencia economica

Los precios, forma de pago, facturacion, vigencia, renovacion, impuestos, saldos, cortes, paquetes, descuentos comerciales, compras de tiles o incrementos de exposicion se estableceran en anexo, orden de servicio, cotizacion, panel de contratacion o aceptacion digital.

La falta de pago, contracargo, pago rechazado, saldo insuficiente, informacion fiscal incompleta o incumplimiento economico podra causar suspension, bloqueo, limitacion o terminacion de servicios.

## 14. Proteccion al consumidor y responsabilidad frente a usuarios

El SPONSOR sera responsable frente a consumidores, usuarios, asistentes o clientes por los productos, servicios, descuentos, promociones, eventos, boletos, delivery o experiencias que ofrezca.

El SPONSOR debera proporcionar informacion clara, veraz y comprobable sobre sus productos o servicios, incluyendo condiciones, restricciones, disponibilidad, vigencia y caracteristicas relevantes.

ANTOJADOS actua como plataforma digital de exposicion, publicacion, descubrimiento, interaccion o intermediacion tecnica segun el servicio contratado, salvo que un anexo establezca expresamente otra calidad.

## 15. Datos personales

Cada Parte debera cumplir con la normativa aplicable en materia de proteccion de datos personales.

Cuando ANTOJADOS trate datos personales como responsable, lo hara conforme a su aviso de privacidad. Cuando el SPONSOR reciba datos de clientes, asistentes, compradores, usuarios o contactos, sera responsable de su propio tratamiento, salvo que un anexo disponga lo contrario.

El SPONSOR no debera subir, publicar o compartir datos personales de terceros sin base legal, autorizacion o consentimiento correspondiente.

## 16. Propiedad intelectual y derechos de terceros

El SPONSOR garantiza que cuenta con todos los derechos, licencias, autorizaciones o permisos para usar y publicar:

- Logos.
- Fotografias.
- Videos.
- Textos.
- Marcas.
- Musica.
- Imagen de personas.
- Material promocional.
- Nombres de eventos.
- Obras protegidas.

El SPONSOR sacara en paz y a salvo a ANTOJADOS frente a reclamaciones derivadas del contenido, derechos de autor, imagen, marca, publicidad, productos, eventos o servicios del SPONSOR.

## 17. Indemnidad

El SPONSOR se obliga a indemnizar, defender y mantener libre de responsabilidad a ANTOJADOS, sus empresas relacionadas, representantes, colaboradores, proveedores y operadores frente a reclamaciones, sanciones, multas, danos, gastos, costos, honorarios o procedimientos derivados de:

- Contenido publicado por el SPONSOR.
- Incumplimiento legal del SPONSOR.
- Productos o servicios ofrecidos por el SPONSOR.
- Eventos organizados por el SPONSOR.
- Uso no autorizado de derechos de terceros.
- Promociones, descuentos o informacion enganosa del SPONSOR.
- Datos personales cargados o tratados indebidamente por el SPONSOR.
- Incumplimiento de permisos, licencias o autorizaciones.

## 18. Limitacion de responsabilidad

En la maxima medida permitida por la ley aplicable, ANTOJADOS no sera responsable por:

- Lucro cesante.
- Perdida de ventas.
- Perdida de oportunidad.
- Perdida de reputacion atribuible al SPONSOR.
- Fallas de terceros.
- Baja conversion.
- Ausencia de asistentes.
- Variacion de ranking.
- Interrupciones razonables.
- Rechazo de contenido por moderacion.
- Contenido publicado por el SPONSOR.
- Incumplimiento del SPONSOR con usuarios o autoridades.

La responsabilidad total de ANTOJADOS, si llegara a determinarse, se limitara al monto efectivamente pagado por el SPONSOR por el servicio especifico que dio origen a la reclamacion durante el periodo que se establezca en el anexo aplicable, salvo disposicion legal imperativa en contrario.

## 19. Prohibiciones

Queda prohibido al SPONSOR:

- Publicar publicidad enganosa.
- Suplantar identidad.
- Publicar contenido sin derechos.
- Prometer descuentos inexistentes.
- Vender productos o servicios prohibidos.
- Usar tiles como anuncios promocionales si el formato contratado solo permite marca.
- Alterar metricas o usar bots.
- Incentivar interacciones falsas.
- Subir malware, phishing o enlaces inseguros.
- Capturar o tratar datos personales sin autorizacion.
- Usar AntojadosMx para actividades ilicitas.

## 20. Terminacion y suspension

ANTOJADOS podra suspender o terminar servicios cuando:

- Exista falta de pago.
- Exista incumplimiento del contrato.
- El contenido sea rechazado reiteradamente.
- Existan reclamaciones graves.
- Exista riesgo legal, reputacional, tecnico o de seguridad.
- El SPONSOR proporcione informacion falsa.
- El SPONSOR pierda permisos o autorizaciones necesarias.
- El servicio sea descontinuado con aviso razonable, salvo urgencia tecnica o legal.

La terminacion no libera al SPONSOR de obligaciones pendientes, pagos devengados, responsabilidades frente a usuarios, indemnidad, confidencialidad, propiedad intelectual, datos personales y reclamaciones previas.

## 21. Cambios a servicios y anexos

ANTOJADOS podra crear, modificar, fusionar, renombrar, suspender o retirar componentes, pantallas, formatos, placements, metricas, reglas de ranking, herramientas o servicios futuros.

Cuando un cambio afecte sustancialmente un servicio activo contratado, ANTOJADOS procurara notificar al SPONSOR por medios razonables.

## 22. Confidencialidad

Las Partes deberan mantener confidencial la informacion tecnica, comercial, operativa, financiera, de negocio, algoritmica, contractual o no publica recibida con motivo del servicio.

No sera informacion confidencial aquella que sea publica, ya conocida legitimamente, recibida de tercero autorizado o requerida por autoridad competente.

## 23. Aceptacion digital

El SPONSOR podra aceptar este contrato y sus anexos mediante firma autografa, firma electronica, casilla de aceptacion, confirmacion digital, correo autorizado, panel administrativo, pago del servicio, carga de contenido o uso de las funciones contratadas.

Los registros electronicos, logs, timestamps, usuarios, IPs, confirmaciones, pagos y eventos de sistema podran usarse como evidencia operativa de aceptacion, uso o ejecucion.

## 24. Legislacion y jurisdiccion

El presente contrato se interpretara conforme a las leyes aplicables en Mexico, salvo que las Partes acuerden otra jurisdiccion valida en el anexo correspondiente.

Las Partes procuraran resolver controversias mediante comunicacion y conciliacion comercial. De no lograrse, se someten a los mecanismos y jurisdiccion establecidos en el anexo u orden de servicio aplicable.

## 25. Siguiente lectura contractual

Para activar servicios concretos, usar:

```text
SPONSOR_SERVICES_ANNEX_MODEL_V1.md
```

Para alineacion tecnica, revisar:

```text
api/docs/contracts/CONTRACT_NAVIGATION_MAP.md
api/docs/openapi.yaml
docs/AntojadosMX_Modelo_Operativo_GT_v2_Instance_Dimensions.md
```

