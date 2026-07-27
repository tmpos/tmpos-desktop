# TMPOS Desktop

![Version](https://img.shields.io/badge/version-2.12.11-blue)
![Downloads](https://img.shields.io/github/downloads/tmpos/tmpos-desktop/v2.12.11/total)

Sistema de punto de venta e inventario offline para tiendas, con sincronizacion mediante TMCloud.

## Novedades v2.12.11

- Corrige la sincronizacion de borrados desde TMCloud: el cliente descartaba silenciosamente las eliminaciones reportadas por el servidor.
- Evita refetch redundante de tablas locales durante la descarga de cambios (sincronizacion mas rapida).
- Los borrados pendientes se envian a la nube antes de descargar, para no revivir registros ya eliminados.
- KeepAlive en las vistas con pestanas para no recargar todo al cambiar de sub-modulo.

## Descarga

[![Descargar v2.12.11](https://img.shields.io/badge/Descargar-v2.12.11-brightgreen?style=for-the-badge&logo=windows)](https://github.com/tmpos/tmpos-desktop/releases/download/v2.12.11/TMPOS.Setup.2.12.11.exe)
