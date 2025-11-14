@echo off
echo ========================================
echo   CONFIGURACION DE EMAIL - ADVENTURE WORKS
echo ========================================
echo.
echo Este script te ayudara a configurar el email para enviar facturas.
echo.
echo PASO 1: Configurar Gmail App Password
echo --------------------------------------
echo 1. Ve a: https://myaccount.google.com/
echo 2. Seguridad ^> Verificacion en 2 pasos (activala si no esta)
echo 3. Seguridad ^> Contrasenas de aplicaciones
echo 4. Genera una nueva contrasena para "Correo"
echo 5. Copia la contrasena de 16 caracteres
echo.
echo PASO 2: Ingresar credenciales
echo ------------------------------
set /p EMAIL_USER="noreplyadventureworks2@gmail.com"
set /p EMAIL_PASS="flamenco123"
echo.
echo PASO 3: Actualizando archivo .env
echo ----------------------------------
echo PORT=4000 > .env
echo JWT_SECRET=super-secret-change-me >> .env
echo GOOGLE_CLIENT_ID=TU_CLIENT_ID_DE_GOOGLE >> .env
echo ALLOWED_ORIGINS=http://localhost:5173,https://adventureworkscycle.netlify.app/ >> .env
echo. >> .env
echo # Email configuration for sending invoices >> .env
echo EMAIL_HOST=smtp.gmail.com >> .env
echo EMAIL_PORT=587 >> .env
echo EMAIL_USER=%EMAIL_USER% >> .env
echo EMAIL_PASS=%EMAIL_PASS% >> .env
echo.
echo ¡Configuracion completada!
echo.
echo PASO 4: Reiniciar el servidor
echo ------------------------------
echo Ahora ejecuta: npm run dev
echo.
echo PASO 5: Probar
echo --------------
echo 1. Haz una compra de prueba
echo 2. Ve a la pagina de exito
echo 3. Haz clic en "Enviar Factura por Email"
echo.
pause
