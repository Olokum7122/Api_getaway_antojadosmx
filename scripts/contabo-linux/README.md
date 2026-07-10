# Contabo Linux Scheduler

Reemplaza SQL Server Agent con un scheduler externo en Linux para ejecutar:

- `job1 -> job2` cada 15 minutos
- `job3 -> job4` diario
- `job5` mensual
- `job6` diario
- `job7` semanal

## Que ejecuta

- `ATLX_GT_INTEGRATION.gt_antojados.usp_fei_validate_enrich`
- `ATLX_GT_INTEGRATION.gt_antojados.usp_fei_dispatch_streams`
- `ATLX_GT_INTEGRATION.gt_antojados.usp_tags_dispatch_stream`
- `ATLX_GT_ANALYTICS.gt_antojados.usp_s5_aggregate_daily`
- `ATLX_GT_ANALYTICS.gt_antojados.usp_s5_aggregate_monthly`
- `ATLX_GT_INTEGRATION.gt_antojados.usp_s5_purge_streams`
- `ATLX_GT_INTEGRATION.gt_antojados.usp_fei_purge_processed`

## Archivos

- `.env.example`: variables de conexion
- `run-sql-job.sh`: ejecutor generico con logs y lock
- `run-feed-ingestion.sh`: `job1 -> job2`
- `run-daily-analytics.sh`: `job3 -> job4`
- `run-monthly-analytics.sh`: `job5`
- `run-purges.sh`: utilitario para purgas
- `install-cron.sh`: instala la entrada en `crontab`
- `cron/antojados-scheduler.cron`: plantilla cron

## Preparacion en Contabo

1. Instalar `sqlcmd` para Linux.
2. Copiar esta carpeta al servidor, por ejemplo en `/opt/antojados/api/scripts/contabo-linux`.
3. Crear `.env` a partir de `.env.example`.
4. Dar permisos:

```bash
chmod +x /opt/antojados/api/scripts/contabo-linux/run-sql-job.sh
chmod +x /opt/antojados/api/scripts/contabo-linux/run-feed-ingestion.sh
chmod +x /opt/antojados/api/scripts/contabo-linux/run-daily-analytics.sh
chmod +x /opt/antojados/api/scripts/contabo-linux/run-monthly-analytics.sh
chmod +x /opt/antojados/api/scripts/contabo-linux/install-cron.sh
```

5. Crear carpetas de logs y lock si quieres dejarlas con otro owner:

```bash
sudo mkdir -p /var/log/antojados-scheduler /var/lock/antojados-scheduler
sudo chown -R "$USER":"$USER" /var/log/antojados-scheduler /var/lock/antojados-scheduler
```

## Instalacion del cron

```bash
cd /opt/antojados/api/scripts/contabo-linux
cp .env.example .env
./install-cron.sh
crontab -l
```

## Ejecucion manual

```bash
cd /opt/antojados/api/scripts/contabo-linux
./run-feed-ingestion.sh
./run-daily-analytics.sh
./run-monthly-analytics.sh
```

## Comportamiento operativo

- Respeta frecuencias equivalentes a SQL Agent.
- Usa `flock` para evitar corridas traslapadas.
- Si una corrida ya esta activa, la nueva sale sin error.
- Si cualquier step falla, el script termina con error.
- Los logs quedan en `LOG_DIR`, por default `/var/log/antojados-scheduler`.
