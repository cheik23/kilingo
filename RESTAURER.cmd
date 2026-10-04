@echo off
REM ===================================================================
REM  LINGUA NOIR — RESTAURATION COMPLETE
REM  Lance ce fichier en double-clic, ou dans un terminal.
REM  Il fait tout : dependances -> Convex -> schema -> donnees -> app
REM ===================================================================
setlocal
cd /d "%~dp0"
echo.
echo ==========================================
echo   LINGUA NOIR - restauration
echo ==========================================
echo.

REM --- 1. Dependances -------------------------------------------------
if not exist "node_modules\" (
  echo [1/5] Installation des dependances...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :fail
) else (
  echo [1/5] Dependances deja installees. OK.
)

REM --- 2. Connexion Convex -------------------------------------------
echo.
echo [2/5] Connexion a Convex Cloud...
call npx convex login
if errorlevel 1 goto :fail

REM --- 3. Creation du projet + schema ---------------------------------
echo.
echo [3/5] Creation du deploiement et envoi du schema...
echo       (nom de projet : lingua-noir ^| heberge : Cloud)
call npx convex dev --once --configure new --project lingua-noir --dev-deployment cloud
if errorlevel 1 goto :fail

REM --- 4. Donnees : les expressions d'argot ----------------------------
echo.
echo [4/5] Rejeu des seeds d'argot...
call npx convex run slang:seed
call npx convex run crossSeed:seedCrossConcepts
echo       slang:seed est idempotent : tu peux le relancer sans risque.

REM --- 5. App ---------------------------------------------------------
echo.
echo [5/5] Demarrage de l'application sur http://localhost:5173
echo.
call npm run dev

goto :end

:fail
echo.
echo ==========================================
echo   ECHEC - voir le message ci-dessus.
echo   Relis CONTESTE-APP.md section 7.
echo ==========================================
pause
exit /b 1

:end
endlocal