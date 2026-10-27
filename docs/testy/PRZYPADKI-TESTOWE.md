# Przypadki testowe — pełna lista

Plik wygenerowany automatycznie skryptem `scripts/test-cases.mjs` z prawdziwego logu
[`logi/przebieg-testow.log`](logi/przebieg-testow.log). Nie edytuj ręcznie — uruchom ponownie:

```bash
npm run test:log && node scripts/test-cases.mjs
```

## Nagłówek uruchomienia

```
=====================================================================
 tebBasket — log z uruchomienia testów automatycznych
=====================================================================
 Data:         27.10.2026, 15:24:58
 Node.js:      v22.16.0 (win32 x64)
 Commit:       53bb224 (main)
 Polecenie:    npx vitest run --reporter=verbose
 Czas trwania: 6.8 s
 Kod wyjścia:  0 (WSZYSTKIE TESTY ZALICZONE)
=====================================================================
```

## Podsumowanie według modułów

| Moduł | Liczba testów | Zaliczone |
|---|---|---|
| Silnik gry (`src/game/engine.ts`) | 20 | 20 |
| Progresja i balans (`src/lib/progression.ts`) | 15 | 15 |
| Stroje + zgodność z bazą (`src/lib/outfits.ts`, `supabase/schema.sql`) | 15 | 15 |
| Backend offline (`src/lib/api.ts`) | 16 | 16 |
| Symulacje meczów (cały silnik + AI) | 8 | 8 |
| **Razem** | **74** | **74** |

## Wszystkie przypadki

| ID | Moduł | Grupa | Co sprawdza (oczekiwany wynik) | Wynik |
|---|---|---|---|---|
| T-EN-01 | Silnik gry | Silnik: przebieg meczu | mecz startuje od intro, potem rzut sędziowski, potem gra | ✅ zaliczony |
| T-EN-02 | Silnik gry | Silnik: przebieg meczu | rzut sędziowski jest losowy — w 40 meczach piłkę dostają obie strony | ✅ zaliczony |
| T-EN-03 | Silnik gry | Silnik: przebieg meczu | trening: bez przeciwnika, bez rzutu sędziowskiego, kończy się po czasie bez zwycięzcy | ✅ zaliczony |
| T-EN-04 | Silnik gry | Silnik: przebieg meczu | zegar akcji: po 14 s bez rzutu piłka przechodzi do rywala | ✅ zaliczony |
| T-EN-05 | Silnik gry | Silnik: przebieg meczu | remis po czasie → złoty kosz; pierwszy kosz kończy mecz | ✅ zaliczony |
| T-EN-06 | Silnik gry | Silnik: przebieg meczu | buzzer beater: rzut w powietrzu w chwili syreny się liczy i wygrywa mecz | ✅ zaliczony |
| T-EN-07 | Silnik gry | Silnik: rzuty | okno idealnego rzutu: ±0,045 s od szczytu wyskoku | ✅ zaliczony |
| T-EN-08 | Silnik gry | Silnik: rzuty | przytrzymanie i puszczenie na szczycie = rzut „IDEALNIE” | ✅ zaliczony |
| T-EN-09 | Silnik gry | Silnik: rzuty | szybkie kliknięcie = zwykły rzut bez celownika | ✅ zaliczony |
| T-EN-10 | Silnik gry | Silnik: rzuty | zbyt długie trzymanie → automatyczne „ZA PÓŹNO” | ✅ zaliczony |
| T-EN-11 | Silnik gry | Silnik: rzuty | szansa trafienia: bliżej = łatwiej, obrońca przeszkadza, wynik w [4%, 97%] | ✅ zaliczony |
| T-EN-12 | Silnik gry | Silnik: rzuty | powershot trafia zawsze (100%), nawet przy najgorszym losowaniu | ✅ zaliczony |
| T-EN-13 | Silnik gry | Silnik: rzuty | wsad: blisko kosza akcja zmienia się we wsad, zawodnik wisi na obręczy, +2 pkt | ✅ zaliczony |
| T-EN-14 | Silnik gry | Silnik: obrona i zagrania specjalne | udany przechwyt zabiera piłkę, liczy się w statystykach i ładuje powershot | ✅ zaliczony |
| T-EN-15 | Silnik gry | Silnik: obrona i zagrania specjalne | nieudany przechwyt „zamraża” obrońcę — nie da się spamować | ✅ zaliczony |
| T-EN-16 | Silnik gry | Silnik: obrona i zagrania specjalne | przechwyt z daleka (> 75 px) nie ma szans | ✅ zaliczony |
| T-EN-17 | Silnik gry | Silnik: obrona i zagrania specjalne | blok: obrońca w powietrzu w chwili wypuszczenia piłki zbija rzut | ✅ zaliczony |
| T-EN-18 | Silnik gry | Silnik: obrona i zagrania specjalne | zwód przy sięgającym obrońcy przewraca go („ZWÓD!”) | ✅ zaliczony |
| T-EN-19 | Silnik gry | Silnik: obrona i zagrania specjalne | „W OGNIU”: 3 kosze z rzędu bez odpowiedzi, gaśnie po koszu rywala | ✅ zaliczony |
| T-EN-20 | Silnik gry | Silnik: obrona i zagrania specjalne | maskotka: tylko akcje gracza, zwykłe max co 6 s, wielkie zawsze | ✅ zaliczony |
| T-API-01 | Backend offline | Backend offline: konto | bez zmiennych Supabase gra działa w trybie offline | ✅ zaliczony |
| T-API-02 | Backend offline | Backend offline: konto | nowy gracz: poziom 1, 0 monet, 0 klejnotów, 2 stroje startowe, ranking 1000 | ✅ zaliczony |
| T-API-03 | Backend offline | Backend offline: konto | profil przetrwa „odświeżenie strony” (restore z localStorage) | ✅ zaliczony |
| T-API-04 | Backend offline | Backend offline: konto | walidacja nazwy gracza: 3–16 znaków, litery/cyfry/_ | ✅ zaliczony |
| T-API-05 | Backend offline | Backend offline: konto | nie da się założyć stroju, którego się nie posiada | ✅ zaliczony |
| T-API-06 | Backend offline | Backend offline: mecze i nagrody | wygrany szybki mecz: +70 XP, +35 monet, +1 wygrana, ranking bez zmian | ✅ zaliczony |
| T-API-07 | Backend offline | Backend offline: mecze i nagrody | przegrany ranked: −15 rankingu, +1 porażka, XP za udział | ✅ zaliczony |
| T-API-08 | Backend offline | Backend offline: mecze i nagrody | awans poziomu daje 10 klejnotów (jedyne darmowe źródło) | ✅ zaliczony |
| T-API-09 | Backend offline | Backend offline: mecze i nagrody | trening nie liczy się do bilansu wygranych/porażek | ✅ zaliczony |
| T-API-10 | Backend offline | Backend offline: sklep | zakup za mało środków → błąd, nic się nie zmienia | ✅ zaliczony |
| T-API-11 | Backend offline | Backend offline: sklep | zarobione monety → zakup stroju → można go założyć | ✅ zaliczony |
| T-API-12 | Backend offline | Backend offline: sklep | ponowny zakup posiadanego stroju nic nie kosztuje | ✅ zaliczony |
| T-API-13 | Backend offline | Backend offline: sklep | symulowany zakup klejnotów i wymiana na monety | ✅ zaliczony |
| T-API-14 | Backend offline | Backend offline: sklep | reset postępu wraca do zera, ale zostawia nazwę i ustawienia | ✅ zaliczony |
| T-API-15 | Backend offline | Backend offline: ranking | ranking jest posortowany malejąco i zawiera gracza | ✅ zaliczony |
| T-API-16 | Backend offline | Backend offline: ranking | wygrany mecz rankingowy powiadamia otwarty ranking (odświeżenie na żywo) | ✅ zaliczony |
| T-PR-01 | Progresja i balans | Progresja: XP i poziomy | próg XP rośnie liniowo: 100 + (lvl−1)·40 | ✅ zaliczony |
| T-PR-02 | Progresja i balans | Progresja: XP i poziomy | awans o jeden poziom z przeniesieniem nadwyżki XP | ✅ zaliczony |
| T-PR-03 | Progresja i balans | Progresja: XP i poziomy | kilka awansów naraz przy dużej nagrodzie | ✅ zaliczony |
| T-PR-04 | Progresja i balans | Progresja: XP i poziomy | brak awansu poniżej progu | ✅ zaliczony |
| T-PR-05 | Progresja i balans | Progresja: XP i poziomy | za awans przysługuje 10 klejnotów | ✅ zaliczony |
| T-PR-06 | Progresja i balans | Progresja: nagrody za mecz | hierarchia XP ze specyfikacji: ranked > quick > trening | ✅ zaliczony |
| T-PR-07 | Progresja i balans | Progresja: nagrody za mecz | przegrana też daje XP (mniej niż wygrana) | ✅ zaliczony |
| T-PR-08 | Progresja i balans | Progresja: nagrody za mecz | trening: 5 XP bazowo + 1 za celny rzut, max 20, nigdy „wygrana” | ✅ zaliczony |
| T-PR-09 | Progresja i balans | Progresja: nagrody za mecz | ranking zmienia się tylko w trybie ranked | ✅ zaliczony |
| T-PR-10 | Progresja i balans | Progresja: statystyki z poziomu | poziom 1 = statystyki bazowe | ✅ zaliczony |
| T-PR-11 | Progresja i balans | Progresja: statystyki z poziomu | bonusy rosną z poziomem, ale mają limit | ✅ zaliczony |
| T-PR-12 | Progresja i balans | Balans: NPC zawsze słabszy od gracza | quick: każda statystyka NPC wyraźnie niższa niż gracza (poziomy 1–40) | ✅ zaliczony |
| T-PR-13 | Progresja i balans | Balans: NPC zawsze słabszy od gracza | ranked: NPC słabszy, ale mniej niż w quick | ✅ zaliczony |
| T-PR-14 | Progresja i balans | Balans: NPC zawsze słabszy od gracza | inteligencja AI: quick = 0,2, ranked w przedziale 0,28–0,36 dla każdego rankingu (poniżej przeciętnego gracza 0,4) | ✅ zaliczony |
| T-PR-15 | Progresja i balans | Balans: NPC zawsze słabszy od gracza | poziom NPC nigdy nie przekracza poziomu gracza i nie spada poniżej 1 | ✅ zaliczony |
| T-OU-01 | Stroje + zgodność z bazą | Katalog strojów | identyfikatory strojów są unikalne | ✅ zaliczony |
| T-OU-02 | Stroje + zgodność z bazą | Katalog strojów | dokładnie 2 stroje startowe są darmowe (TEB niebieski i biały) | ✅ zaliczony |
| T-OU-03 | Stroje + zgodność z bazą | Katalog strojów | każdy płatny strój ma cenę w monetach ALBO klejnotach, większą od zera | ✅ zaliczony |
| T-OU-04 | Stroje + zgodność z bazą | Katalog strojów | wszystkie kolory są poprawnym zapisem #RRGGBB | ✅ zaliczony |
| T-OU-05 | Stroje + zgodność z bazą | Katalog strojów | każdy strój ma nazwę po polsku i angielsku | ✅ zaliczony |
| T-OU-06 | Stroje + zgodność z bazą | Katalog strojów | nieznany strój → bezpieczny fallback na pierwszy z katalogu | ✅ zaliczony |
| T-OU-07 | Stroje + zgodność z bazą | Katalog strojów | buildLook łączy strój z wyglądem i nie gubi wzoru | ✅ zaliczony |
| T-OU-08 | Stroje + zgodność z bazą | Katalog strojów | wymiana klejnotów zawsze opłaca się bardziej przy większym pakiecie | ✅ zaliczony |
| T-OU-09 | Stroje + zgodność z bazą | Katalog strojów | domyślny wygląd ma numer 12 (jak na grafice ze specyfikacji) | ✅ zaliczony |
| T-SQL-01 | Stroje + zgodność z bazą | Zgodność klient ↔ serwer (supabase/schema.sql) | ceny strojów w bazie = ceny w grze | ✅ zaliczony |
| T-SQL-02 | Stroje + zgodność z bazą | Zgodność klient ↔ serwer (supabase/schema.sql) | nagrody XP i monet w finish_match() = REWARDS w progression.ts | ✅ zaliczony |
| T-SQL-03 | Stroje + zgodność z bazą | Zgodność klient ↔ serwer (supabase/schema.sql) | klejnoty za awans w bazie = GEMS_PER_LEVEL | ✅ zaliczony |
| T-SQL-04 | Stroje + zgodność z bazą | Zgodność klient ↔ serwer (supabase/schema.sql) | nowe konto startuje z 0 monet i 0 klejnotów | ✅ zaliczony |
| T-SQL-05 | Stroje + zgodność z bazą | Zgodność klient ↔ serwer (supabase/schema.sql) | pakiety wymiany i mock płatności mają te same ID co w grze | ✅ zaliczony |
| T-SQL-06 | Stroje + zgodność z bazą | Zgodność klient ↔ serwer (supabase/schema.sql) | RLS włączone na wszystkich tabelach, klient nie może zmieniać waluty | ✅ zaliczony |
| T-SIM-01 | Symulacje meczów | Symulacja balansu (60 pełnych meczów) | każdy mecz kończy się poprawnie (zwycięzca, czas ≈ 3 min + przerwy) | ✅ zaliczony |
| T-SIM-02 | Symulacje meczów | Symulacja balansu (60 pełnych meczów) | szybki mecz: przeciętny gracz wygrywa ≥ 80% (NPC wyraźnie słabszy) | ✅ zaliczony |
| T-SIM-03 | Symulacje meczów | Symulacja balansu (60 pełnych meczów) | ranked: gracz wygrywa częściej niż przegrywa, ale nie zawsze (NPC tylko trochę słabszy) | ✅ zaliczony |
| T-SIM-04 | Symulacje meczów | Symulacja balansu (60 pełnych meczów) | przewaga punktowa w ranked jest mniejsza niż w szybkim meczu | ✅ zaliczony |
| T-SIM-07 | Symulacje meczów | Symulacja balansu (60 pełnych meczów) | w KAŻDEJ konfiguracji (poziom/ranking) gracz ma przewagę — NPC nigdy nie jest silniejszy | ✅ zaliczony |
| T-SIM-05 | Symulacje meczów | Symulacja balansu (60 pełnych meczów) | NPC nie jest bezbronny — zdobywa punkty w każdym meczu | ✅ zaliczony |
| — | Symulacje meczów | Symulacja balansu (60 pełnych meczów) | zapisuje raport do docs/testy/logi/symulacja-balansu.md | ✅ zaliczony |
| T-SIM-06 | Symulacje meczów | Turniej fikcyjnych graczy (fake data) | 12 fikcyjnych graczy gra po meczu rankingowym; ranking i XP przeliczone regułami gry | ✅ zaliczony |
