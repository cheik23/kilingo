@echo off
REM ===================================================================
REM  KILINGO — DEMARRAGE COMPLET
REM  Double-clique sur ce fichier (Docker Desktop doit etre lance).
REM
REM  Le backend Convex tourne EN LOCAL dans Docker : aucun compte
REM  Convex Cloud n'est necessaire. npx convex dev --local echoue sur
REM  Windows, c'est pour ca que le backend passe par Docker.
REM ===================================================================
setlocal
cd /d "%~dp0"

echo.
echo ==========================================
echo   KILINGO - demarrage
echo ==========================================

REM --- 1. Dependances -------------------------------------------------
if not exist "node_modules\" (
  echo.
  echo [1/4] Installation des dependances...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :fail
) else (
  echo [1/4] Dependances deja installees. OK.
)

REM --- 2. Backend Convex local + schema + donnees ----------------------
echo.
echo [2/4] Preparation du backend Convex local (Docker)...
node scripts\brancher-backend.mjs
if errorlevel 1 goto :fail

REM --- 3. Typecheck ---------------------------------------------------
echo [3/4] Verification TypeScript...
call npx tsc -b --pretty false
if errorlevel 1 goto :fail
echo       TypeScript OK.

REM --- 4. Application -------------------------------------------------
echo.
echo [4/4] Demarrage de l'application...
echo.
echo   App        : http://localhost:5173
echo   Convex     : http://127.0.0.1:33210
echo   Site/auth  : http://host.docker.internal:33211
echo.
call npm run dev

goto :end

:fail
echo.
echo ==========================================
echo   ECHEC - voir le message ci-dessus.
echo   Section 7 de CONTESTE-APP.md :
echo   liste les pieges du self-hosted et
echo   comment les resoudre.
echo ==========================================
pause
exit /b 1

:end
endlocal