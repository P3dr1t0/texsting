# Ícono de TeXsting

Render 3D propio (sin motor 3D): toma el contorno de las letras «TeX's» (Latin Modern Bold, con la E
bajada como el logo de TeX), las extruye y las proyecta con una cámara en perspectiva al estilo del
cuadro final de una intro de cine clásica, mirando un poco más hacia abajo (variante 3, elegida por Pedro).

    python3 tools/icono/make_assets.py

Genera en `assets/`: ícono adaptable (primer plano transparente + fondo), ícono clásico, ícono de
Play Store (512 px), pantallas de arranque e imagen destacada de Play Store (1024×500).
Requiere numpy, matplotlib y Pillow.
