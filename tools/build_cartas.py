"""Genera public/cartas.json y public/cartas/NN.webp a partir de cartas/lista_cartas.xlsx
y las imágenes (PNG o JPG) de cartas/. Uso:  python tools/build_cartas.py

Para agregar cartas: añade la fila en el Excel (Número, Maya, Español, Pista) y deja el PNG
en cartas/ con el nombre maya en el archivo (carta_NN_NOMBRE.png); luego vuelve a ejecutar.
"""
import json, re, sys, unicodedata
from pathlib import Path
import openpyxl
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "cartas"
OUT = ROOT / "docs"
ANCHO = 400


def norm(s):
    s = unicodedata.normalize("NFD", str(s).lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"^[uy][ _]+", "", s.strip())  # "U kúuchil" / "Y kúuchil" son la misma carta
    return re.sub(r"[^a-z0-9]", "", s)


png = {}
for f in sorted(SRC.iterdir()):
    if f.suffix.lower() not in (".png", ".jpg", ".jpeg"):
        continue
    m = re.match(r"carta_\d+_(.*)$", f.stem, re.I)
    png[norm(m.group(1) if m else f.stem)] = f  # si hay PNG y JPG de la misma carta, gana el último alfabéticamente

ws = openpyxl.load_workbook(SRC / "lista_cartas.xlsx").active
(OUT / "cartas").mkdir(parents=True, exist_ok=True)
cartas, errores = [], []
for fila in list(ws.iter_rows(values_only=True))[1:]:
    if not fila or fila[0] is None:
        continue
    n, maya, es, pista = int(fila[0]), str(fila[1]).strip(), str(fila[2]).strip(), str(fila[3] or "").strip()
    f = png.get(norm(maya))
    if not f:
        errores.append(f"Sin imagen para {n} {maya}")
        continue
    im = Image.open(f).convert("RGB")
    im = im.resize((ANCHO, round(im.height * ANCHO / im.width)), Image.LANCZOS)
    im.save(OUT / "cartas" / f"{n}.webp", "WEBP", quality=82, method=6)
    cartas.append({"n": n, "maya": maya, "es": es, "pista": pista, "img": f"cartas/{n}.webp"})

cartas.sort(key=lambda c: c["n"])
if len({c["n"] for c in cartas}) != len(cartas):
    errores.append("Hay números repetidos en el Excel")
(OUT / "cartas.json").write_text(json.dumps(cartas, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"{len(cartas)} cartas generadas")
if errores:
    print("\n".join(errores)); sys.exit(1)
