@echo off
title Jukebox da Festa - servidor local
cd /d "%~dp0"
echo Iniciando o servidor da Jukebox...
node servidor-jukebox.mjs "C:\musicas\jukebox" 8099
echo.
echo O servidor parou. Pressione qualquer tecla para fechar.
pause >nul
