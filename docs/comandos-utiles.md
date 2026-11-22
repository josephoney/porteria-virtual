# Comandos útiles

Referencia rápida para operar el proyecto. Para el detalle de cada procedimiento
ver `DEPLOY.md` y `docs/runbook-produccion.md`.

Convenciones de este documento:

- **PC** → tu máquina, PowerShell en `C:\ProjectsData\ReactProjects\PorteriaVirtual`.
- **Servidor** → el VPS, `root@140.82.30.77`.
- `~/porteria` → el repo en el servidor.

---

## 1. Conectarse al servidor

```bash
ssh porteria
```

El alias está definido en `C:\Users\Usuario\.ssh\config`:

```
Host porteria
    HostName 140.82.30.77
    User root
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

### Si vuelve a pedir la contraseña de root

La clave no está autorizada. En el servidor, con una sesión abierta:

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
cat >> ~/.ssh/authorized_keys
# pegar la salida de: Get-Content "$HOME\.ssh\id_ed25519.pub"
# Enter y Ctrl+D
chmod 600 ~/.ssh/authorized_keys
tail -n 1 ~/.ssh/authorized_keys
```

### Para no escribir la passphrase cada vez

En **PC** (PowerShell como administrador):

```powershell
Get-Service ssh-agent | Set-Service -StartupType Automatic
Start-Service ssh-agent
ssh-add "$HOME\.ssh\id_ed25519"
```

Dura hasta cerrar sesión de Windows o reiniciar.

### Si se pierde la contraseña de root

Vultr → Products → el servidor → **View Console** (terminal en el navegador,
autenticada con la cuenta de Vultr). Ahí:

```bash
passwd root
```

La contraseña de la cuenta de Vultr **no** es la de root.

### Endurecer SSH (sólo después de confirmar que la clave funciona)

```bash
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sshd -t && systemctl reload ssh
```

`sshd -t` valida la configuración antes de recargar. No cierres la sesión
actual hasta probar el acceso desde otra terminal.

### Diagnosticar por qué la clave no funciona

Si `ssh porteria` pide la contraseña de root, la clave pública no está siendo
aceptada. Recorrer en este orden.

**1. Ver el archivo tal cual está** (en el servidor):

```bash
cat -A ~/.ssh/authorized_keys
```

Cada `^M` al final de una línea es un CR de Windows. Cualquier línea que no
empiece con `ssh-ed25519`, `ssh-rsa` o `ecdsa-sha2-` es basura: comandos
pegados, contraseñas escritas por error, líneas vacías. `sshd` las salta, pero
ensucian el archivo y confunden el diagnóstico.

**2. Limpiar dejando sólo claves válidas:**

```bash
cp ~/.ssh/authorized_keys ~/.ssh/authorized_keys.bak
grep -E '^ssh-(ed25519|rsa) ' ~/.ssh/authorized_keys \
  | tr -d '\r' | awk '{print $1" "$2}' | sort -u > /tmp/ak
cat -A /tmp/ak          # una sola línea, sin ^M
mv /tmp/ak ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

`awk '{print $1" "$2}'` descarta el comentario final —irrelevante para
autenticar— y cualquier texto pegado en la misma línea.

**3. Comparar las huellas.** En el servidor:

```bash
ssh-keygen -lf ~/.ssh/authorized_keys
```

En el **PC**:

```powershell
ssh-keygen -lf "$HOME\.ssh\id_ed25519.pub"
```

Los `SHA256:...` tienen que ser **idénticos**. Si difieren, la clave del servidor
no es la de tu PC. Reemplazarla desde PowerShell:

```powershell
Get-Content "$HOME\.ssh\id_ed25519.pub" -Raw `
  | ssh root@140.82.30.77 "tr -d '\r' > ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

El `tr -d '\r'` es lo que evita que vuelvan a entrar los CR.

**4. Ver qué decidió el servidor:**

```bash
ls -ld /root /root/.ssh /root/.ssh/authorized_keys   # 700 / 700 / 600, root:root
sshd -T | grep -Ei "pubkeyauthentication|permitrootlogin|strictmodes"
grep -iE "authentication refused|bad ownership|bad modes" /var/log/auth.log | tail -20
```

Con `strictmodes yes`, `sshd` ignora la clave en silencio si el home o el archivo
son escribibles por otros, y cae a pedir contraseña sin avisar.

**5. Ver qué ofrece el cliente.** En el **PC**:

```powershell
ssh -v porteria
```

| Línea en la salida                            | Significa                           |
| --------------------------------------------- | ----------------------------------- |
| `Offering public key`                         | El cliente está ofreciendo la clave |
| `Server accepts key`                          | El servidor la aceptó               |
| `Authentications that can continue: password` | El servidor la rechazó              |

Si **no** aparece `Offering public key`, el problema no es el servidor: el
cliente no está usando esa clave. Verificar que se llame con el alias
`ssh porteria` y no con `ssh root@140.82.30.77`, porque el bloque `Host porteria`
del `config` sólo se aplica al alias.

---

## 2. Git

### En el PC

```powershell
git status --short
git log --oneline -5
git pull --ff-only origin master
```

### En el servidor

```bash
cd ~/porteria
git log -1 --oneline
git pull --ff-only origin master
```

Si el pull falla por cambios locales, mirar `git status --short`. **No** usar
`git reset --hard` en el servidor sin revisar antes qué se va a perder.

---

## 3. Deploy a staging

```bash
cd ~/porteria
git pull --ff-only origin master
bash deploy/update.sh
```

`deploy/update.sh` hace: `git pull --ff-only`, `docker compose up -d --build`,
`docker image prune -f` y muestra el estado.

Resultado esperado:

- `migrate exited (0)` → migraciones aplicadas.
- `migrate exited (1)` → migración fallida, la API no arranca. Revisar logs.
- `api ... (healthy)`.

### Si cambió sólo el compose o una env

`restart` **no** alcanza: Docker tiene que recrear el contenedor.

```bash
docker compose -f docker-compose.staging.yml --env-file .env.staging \
  up -d --force-recreate api
```

### Producción

```bash
cd ~/porteria/deploy
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

---

## 4. Estado y logs

```bash
cd ~/porteria

# Estado de los servicios
docker compose -f docker-compose.staging.yml --env-file .env.staging ps

# Logs de la API
docker compose -f docker-compose.staging.yml --env-file .env.staging logs --tail=100 api

# Buscar errores
docker compose -f docker-compose.staging.yml --env-file .env.staging logs --tail=200 api | grep -iE "error|exception"

# Logs de correo
docker compose -f docker-compose.staging.yml --env-file .env.staging logs --tail=100 api | grep -i mail

# Uso de disco
df -h
docker system df
```

### Health checks

```bash
curl -s https://staging.zimaseguridad.com.co/api/ready
curl -s https://staging.zimaseguridad.com.co/api/version
```

---

## 5. Correo (ZeptoMail)

Verificar que las variables llegaron al contenedor **sin imprimir el token**:

```bash
docker compose -f docker-compose.staging.yml --env-file .env.staging exec api sh -lc '
  echo "API_URL=$ZEPTOMAIL_API_URL";
  echo "FROM=$MAIL_FROM";
  echo -n "$ZEPTOMAIL_TOKEN" | wc -c
'
```

Esperado: la URL de la API, el remitente completo y un número mayor que 0.

### Diagnóstico de fallas

| Código en logs        | Causa                                                                |
| --------------------- | -------------------------------------------------------------------- |
| `mail_not_configured` | Faltan `ZEPTOMAIL_TOKEN` o `MAIL_FROM`, o el contenedor no se recreó |
| `401` / `403`         | Token o región incorrectos                                           |
| `400`                 | Remitente o dominio sin verificar (SPF/DKIM)                         |
| `429`                 | Límite de envíos del proveedor                                       |

### Si el correo cae en spam

Es reputación de dominio nuevo, no un bug. Mover el mensaje a «No es spam»
ayuda más rápido que cualquier cambio de configuración.

---

## 6. Base de datos

### Backup manual

```bash
cd ~/porteria
docker compose -f docker-compose.staging.yml --env-file .env.staging exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "backup-$(date +%F).dump"
```

Guardar el archivo **fuera del servidor**. Un backup que nunca se restauró no
es un backup.

### Restaurar

```bash
# Detener la API para evitar escrituras
docker compose -f docker-compose.staging.yml --env-file .env.staging stop api

docker compose -f docker-compose.staging.yml --env-file .env.staging exec -T db \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists < backup.dump

docker compose -f docker-compose.staging.yml --env-file .env.staging start api
```

### Consola SQL

```bash
docker compose -f docker-compose.staging.yml --env-file .env.staging exec db \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

### Tamaño de las tablas

```sql
SELECT relname AS tabla,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS tamaño
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY pg_total_relation_size(c.oid) DESC
LIMIT 20;
```

---

## 7. Archivos subidos (logos)

Los assets viven en el volumen `porteria_assets-data`, montado en `/data/uploads`.

```bash
# Ver el montaje
docker inspect porteria-api-1 \
  --format '{{range .Mounts}}{{.Type}} -> {{.Destination}} ({{.Name}}){{"\n"}}{{end}}'

# Listar los archivos guardados
docker compose -f docker-compose.staging.yml --env-file .env.staging exec api \
  sh -lc 'find /data/uploads -type f | head -20'
```

Si el volumen no aparece en `docker inspect`, el contenedor no se recreó con la
configuración nueva.

---

## 8. tmux

```bash
tmux ls                      # listar sesiones
tmux a -t expo               # adjuntar a la sesión "expo"
tmux new -s metro            # crear una sesión nueva
```

Dentro de tmux:

- `Ctrl+B` luego `D` → detach (los procesos siguen vivos).
- `Ctrl+B` luego `[` → scroll; `q` para salir.
- `exit` o `Ctrl+D` → cierra la sesión y mata sus procesos.

Si `tmux ls` dice «no server running», no hay ninguna sesión que recuperar.

---

## 9. App móvil

### Metro con túnel (para probar en un teléfono físico)

```bash
cd ~/porteria/apps/zima-qr-access
npx expo start -m tunnel --clear
```

Verificar que la URL impresa sea `...-8081.exp.direct` y **no** `localhost`.
Si dice `localhost`, el túnel no se levantó y el teléfono no va a conectar.

En el dev build: **«Enter URL manually»** y pegar la URL.

### Build de desarrollo con EAS

```powershell
cd C:\ProjectsData\ReactProjects\PorteriaVirtual\apps\zima-qr-access
npx eas build --profile development --platform android
```

Siempre desde `apps/zima-qr-access`. Desde la raíz del monorepo falla porque
`expo` no está instalado ahí.

Cambios de JavaScript → fast refresh, no hace falta rebuild.
Cambios nativos o de env de build → rebuild.

### Typecheck de la app

```bash
pnpm --filter @porteria/zima-qr-access typecheck
```

---

## 10. Verificaciones antes de commitear

```bash
# Tipos
pnpm --filter @porteria/api exec tsc --noEmit

# Tests
pnpm --filter @porteria/api test
pnpm --filter @porteria/api test:integration

# Formato
pnpm exec prettier --check .

# Especificaciones
npx openspec validate --all --strict
```

---

## 11. Problemas frecuentes

| Síntoma                                           | Causa probable                                                  | Solución                             |
| ------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------ |
| Variables de entorno vacías dentro del contenedor | Se cambió el `.env` pero no se recreó el contenedor             | `up -d --force-recreate <servicio>`  |
| Logos desaparecen en cada deploy                  | El volumen no está montado                                      | Revisar `docker inspect` (sección 7) |
| Invitación sin correo, con enlace                 | `emailSent: false`                                              | Sección 5                            |
| `ssh` pide contraseña de root                     | Clave no autorizada                                             | Sección 1                            |
| `authorized_keys` con `^M` o líneas sueltas       | Pegado desde Windows, comandos o contraseñas escritos por error | Sección 1, diagnóstico               |
| Metro imprime `localhost`                         | Túnel no levantado                                              | Sección 9                            |
| `npm install` falla con `matches`                 | npm no entiende el workspace                                    | Usar `pnpm`                          |
