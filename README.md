# Vozački ispit KS

Aplikacija za vježbanje testovnih pitanja za vozački ispit (Kanton Sarajevo).
Izvor: [Katalozi testovnih pitanja — Ministarstvo za odgoj i obrazovanje KS](https://mo.ks.gov.ba/node/17469) (jul 2024).

- 769 pitanja u 4 oblasti (propisi 450, znakovi 109, raskrsnice 110, prva pomoć 100)
- slike izvučene direktno iz PDF kataloga
- vježba po oblastima, probni test, ponavljanje pogrešnih, pretraga; napredak se čuva u browseru

Statička stranica u `public/`. Podaci se regenerišu iz PDF-ova sa `raw/extract.py` (PyMuPDF):

```
cd raw && python3 extract.py   # PDF-ove o1..o4.pdf skinuti sa izvora
```
