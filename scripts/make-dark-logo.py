# Uso: python3 scripts/make-dark-logo.py public/logo_dx.png public/logo_dx_dark.png  (requiere Pillow)
"""Logo para modo oscuro (public/logo_dx_dark.png) a partir de public/logo_dx.png.

- Fondo blanco -> transparente, con bordes suaves sin halo blanco
  (alpha por "distancia al blanco" y color despremultiplicado).
- Letras grises ("data express", ®): color gris uniforme y la cobertura como
  alpha, para que el bisel claro de las letras no se vea como contorno.
- Se quita la sombra gris bajo el anillo (sobre fondo oscuro parece un brillo).
"""
import sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
TEXT_TOP = 258      # primera fila del texto
SHADOW_TOP = 236    # filas de la sombra bajo el anillo
TEXT_GRAY = 148     # gris base de las letras
K_TEXT = 255 - TEXT_GRAY
K = 110.0

im = Image.open(src).convert("RGB")
w, h = im.size
out = Image.new("RGBA", (w, h))
pi, po = im.load(), out.load()

def neutral(c):
    return max(c) - min(c) < 15

for y in range(h):
    row = [pi[x, y] for x in range(w)]
    blue = [x for x, c in enumerate(row) if max(c) - min(c) > 40]
    first, last = (blue[0], blue[-1]) if blue else (w, -1)
    for x, (r, g, b) in enumerate(row):
        d = 255 - min(r, g, b)
        if neutral((r, g, b)):
            # Sombra gris entre el anillo y el texto.
            if SHADOW_TOP <= y < TEXT_TOP and (not blue or x < first or x > last or y >= 252):
                po[x, y] = (0, 0, 0, 0)
                continue
            if y >= TEXT_TOP:
                a = min(1.0, d / K_TEXT)
                po[x, y] = (TEXT_GRAY, TEXT_GRAY, TEXT_GRAY, round(a * 255)) if a > 0.04 else (0, 0, 0, 0)
                continue
        a = min(1.0, d / K)
        if a <= 0.04:
            po[x, y] = (0, 0, 0, 0)
            continue
        un = lambda c: max(0, min(255, round((c - 255 * (1 - a)) / a)))
        po[x, y] = (un(r), un(g), un(b), round(a * 255))
out.save(dst, optimize=True)
print("ok", out.size)
