# SETUP — tebBasket
> Wersja: 1.0 (MVP) | Data: 2026-10-09

Przeglądarkowa gra arcade 1v1 w koszykówkę. Rozgrywka w HTML5 Canvas, meta-warstwa (lobby, szatnia, sklep, ranking) w React 18 + Vite + TypeScript + Tailwind, backend Supabase.

**Gra działa od razu bez backendu.** Jeśli nie podasz zmiennych Supabase, uruchamia się *tryb offline*: profil w `localStorage`, ranking lokalny z przykładowymi graczami. Po podłączeniu Supabase włączają się konta, nagrody liczone po stronie serwera i wspólny ranking na żywo.

---

## 1. Wymagania
- Node.js 18+ (testowane na 22)
- Konto Supabase (supabase.com) — opcjonalnie, dla kont i wspólnego rankingu
- Konto Vercel (vercel.com) — opcjonalnie, do deployu

## 2. Uruchomienie lokalne (offline, bez Supabase)
```bash
npm install
npm run dev
# http://localhost:5173
```

## 3. Supabase — krok po kroku

### 3.1 Utwórz projekt
1. https://supabase.com → **New project**
2. Nazwa: `tebbasket`, Region: **Frankfurt (eu-central-1)**, hasło do bazy zapisz w menedżerze haseł
3. Poczekaj ~2 minuty na inicjalizację

### 3.2 Baza danych — schemat, RLS, funkcje
**SQL Editor → New query →** wklej całą zawartość pliku [`supabase/schema.sql`](supabase/schema.sql) → **Run**.

Skrypt tworzy:

| Obiekt | Opis |
|---|---|
| `profiles` | profil gracza: nazwa, poziom, XP, coins, gems, ranking, stroje, wygląd, ustawienia |
| `matches` | historia meczów (tryb, wynik, przyznane XP/coins/zmiana rankingu) |
| `shop_items` | cennik strojów (musi zgadzać się z `src/lib/outfits.ts`) |
| `purchases` | log zakupów / wymian |
| trigger `on_auth_user_created` | zakłada profil przy rejestracji (nazwa z formularza) |
| trigger `profiles_guard` | nie pozwala założyć stroju, którego gracz nie posiada |
| RPC `finish_match` | **liczy nagrody po stronie serwera** (XP, level-up, coins, ranking) + anty-spam |
| RPC `buy_outfit`, `exchange_gems` | zakup stroju, wymiana gems → coins |
| RPC `mock_purchase` | **TYLKO DEMO** — symulowany zakup gemów (patrz §7) |
| RPC `get_leaderboard` | publiczny ranking (tylko nazwa, poziom, ranking, wygrane) |

### 3.3 Row Level Security — model bezpieczeństwa
RLS jest włączone na wszystkich tabelach od początku:
- gracz **czyta tylko swój** profil, mecze i zakupy (`id = auth.uid()`);
- gracz może **aktualizować wyłącznie kolumny kosmetyczne**: `username`, `outfit`, `appearance`, `settings` (GRANT na poziomie kolumn), więc nie da się z przeglądarki dopisać sobie XP, coinów czy rankingu;
- wszystko, co ekonomiczne, zmienia się tylko przez funkcje `SECURITY DEFINER`, które same liczą wartości;
- ranking innych graczy jest dostępny tylko przez `get_leaderboard()`, które zwraca wyłącznie publiczne kolumny.
- **Nigdy nie używaj klucza `service_role` w kodzie klienta.** Aplikacja używa tylko klucza `anon`.

> ⚠️ Ograniczenie MVP: przeciwnik NPC działa w przeglądarce, więc **wynik meczu** podaje klient. Serwer waliduje zakres (0–200 pkt) i odrzuca mecze zgłaszane częściej niż co 150 s (trening: 90 s), ale nie jest w stanie zweryfikować samego wyniku. Pełna ochrona wymaga symulacji po stronie serwera, co wejdzie razem z PvP.

### 3.4 Authentication
**Authentication → Providers → Email**: włączone (Email + Password).
- **Confirm email**: zalecane włączone. Gracz po rejestracji dostaje maila i loguje się po potwierdzeniu (gra pokazuje odpowiedni komunikat).
- **Authentication → URL Configuration → Site URL**: adres produkcyjny, np. `https://tebbasket.pl`. W **Redirect URLs** dodaj też `http://localhost:5173`.

### 3.5 Realtime (ranking na żywo)
Ranking odświeża się na żywo przez kanał **Broadcast** `leaderboard` (po każdym meczu rankingowym klient wysyła sygnał, a otwarte rankingi pobierają dane ponownie). Nie wymaga to konfiguracji tabel.
Jeśli w **Project Settings → Realtime** włączysz *„Allow only private channels”*, dodaj politykę dla `realtime.messages` albo zostaw kanały publiczne.

### 3.6 Storage
Nie jest używany w MVP (wszystkie grafiki są rysowane proceduralnie w Canvas). Przy własnych skinach: bucket `skins`, public = tak, upload tylko przez Edge Function.

## 4. Zmienne środowiskowe
Skopiuj `.env.example` → `.env.local` i uzupełnij:

| Zmienna | Skąd |
|---|---|
| `VITE_SUPABASE_URL` | Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Project Settings → API → `anon` `public` |

Po zmianie `.env.local` zrestartuj `npm run dev`. Bez tych zmiennych gra działa offline.

## 5. Deploy na Vercel
```bash
npm install -g vercel
vercel
```
- Framework preset: **Vite**, build: `npm run build`, output: `dist`
- Vercel → Project → Settings → **Environment Variables**: dodaj `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY` (Production + Preview), potem redeploy.
- Domena `tebbasket.pl`: Vercel → Domains, a potem zaktualizuj Site URL w Supabase (§3.4).

Hosting: Vercel Free + Supabase Free wystarczą na start (do ~100 aktywnych graczy). Przy większym ruchu: Vercel Pro + Supabase Pro (~200 zł/mies.).

## 6. Decyzje projektowe (odpowiedzi na otwarte pytania ze specyfikacji)
Wszystkie wartości są w jednym miejscu: `src/lib/progression.ts` (klient) i `finish_match()` w `schema.sql` (serwer). Przy zmianie aktualizuj oba.

| Pytanie | Przyjęte w MVP |
|---|---|
| Czas meczu | **3:00** (trening 2:00), zegar 14 s na akcję. Remis po czasie → **„Złoty kosz”** (kto pierwszy trafi, wygrywa) |
| XP za tryby | Ranked: wygrana **120** / przegrana **45** · Quick: **70** / **25** · Trening: **5 + celne rzuty, max 20** (zawsze najmniej) |
| Czy przegrana daje XP | **Tak**, mniej (zachęca do grania) |
| Waluta na start | **0 coins, 0 gems**. Coins za mecz: Ranked 60/15 · Quick 35/10 · Trening 5. Gems: **+10 za każdy awans** (jedyne darmowe źródło) |
| Ranking | start 1000; wygrana +20 + bonus za przewagę (max +10), przegrana −15 |
| Level | próg: `100 + (lvl−1)·40` XP. Level daje: +0,4% szybkości/lvl (max +12%), +0,5% skuteczności/lvl (max +15%), +0,4% skuteczności przechwytu/lvl (max +10%) |
| Powershot | trafia zawsze; pasek ładuje się **25 s** (+20% za udany przechwyt), zużywa cały pasek. W treningu ładuje się 1,8× szybciej |
| Wsad | automatycznie, gdy rzucasz z półokręgu pod koszem (narysowany na parkiecie); 86% bazowej skuteczności |
| Rzut | skuteczność maleje z dystansem (ok. 75% spod kosza, ~47% z linii za 3, poniżej 25% z daleka); obrońca blisko na linii do kosza obniża ją do −30 pp; zza łuku = 3 pkt |
| Przechwyt | zasięg ~75 px, ok. 30–40% szans; nieudany = krótkie „zamroczenie” obrońcy (nie da się spamować) |
| Celownik rzutu | przytrzymaj rzut i puść na szczycie wyskoku: zielone pole = **idealnie** (+20 pp), żółte = dobrze (+6 pp), za wcześnie/późno = −14 pp. Szybkie kliknięcie = zwykły rzut bez modyfikatora |
| Blok | obrońca skacze (ten sam przycisk), gdy rywal składa się do rzutu; musi być w powietrzu przy wypuszczeniu piłki, ~40–60% z bliska. Powershotu nie da się zablokować |
| Zwód (crossover) | Shift/L lub przycisk „zwód”, odnowienie 2,2 s; chwilowy zryw w bok, w trakcie nie da się ukraść piłki; szansa ~12% na przewrócenie obrońcy, +30% gdy obrońca właśnie sięga po piłkę |
| W ogniu | 3 kosze z rzędu bez odpowiedzi rywala: +10 pp do rzutów, powershot ładuje się 1,8× szybciej; gaśnie, gdy rywal trafi (w treningu: po pudle) |
| Buzzer beater / złoty kosz | rzut w powietrzu w chwili syreny się liczy (slow-motion); remis → złoty kosz |
| AI NPC | Zawsze **słabsze od gracza**, liczone względem jego statystyk z poziomu. Quick: −8% szybkości, −10 pp rzutów, −7 pp przechwytów, poziom 1–3 niżej, AI 0,20. Ranked: −3% szybkości, −4 pp rzutów, −3 pp przechwytów, poziom 0–1 niżej, AI 0,28–0,36 (rośnie z rankingiem, zawsze poniżej przeciętnego gracza 0,40). Wyniki symulacji: `docs/testy/logi/symulacja-balansu.md` |
| Sklep | 18 strojów (2 startowe, część z wzorami: prążki, gradient, gwiazdki, szarfa): za coins 250–2000 lub gems 40–150. Wymiana gems→coins: 10→1000, 50→5500, 100→12000. Pakiety gemów za PLN: **tylko UI + mock** |

## 7. Przed produkcją (poza MVP)
1. **Płatności**: podłącz Stripe/Przelewy24 → webhook → Edge Function (z `service_role`) dopisuje gemy. Następnie `drop function public.mock_purchase(text);` i usuń zakładkę mocka w `ShopPanel.tsx`.
2. **PvP online**: Supabase Realtime (Presence + Broadcast) jako matchmaking, autorytatywny serwer gry (np. Edge Function / osobny serwer WebSocket), żeby wynik nie pochodził od klienta.
3. Polityka prywatności / regulamin (RODO): gra przechowuje e-mail i nick.

## 8. Struktura projektu
```
src/
├── game/              # silnik gry (bez Reacta)
│   ├── constants.ts   # wymiary boiska, kosz, fizyka
│   ├── engine.ts      # Match, Athlete, Ball, NpcBrain — cała pętla akcji
│   ├── render.ts      # rysowanie: hala, kibice, gracze, kosz, HUD
│   └── factory.ts     # tworzenie meczu z profilu (NPC, trudność)
├── lib/
│   ├── api.ts         # backend: Supabase albo offline (localStorage), ten sam interfejs
│   ├── supabase.ts    # klient Supabase (null = offline)
│   ├── progression.ts # XP, poziomy, nagrody, statystyki z levelu
│   ├── outfits.ts     # stroje, wygląd, cennik
│   ├── audio.ts       # dźwięki syntezowane (WebAudio, bez plików)
│   ├── i18n.ts        # PL / EN
│   └── actions.ts     # zapis meczu, aktualizacja profilu
├── pages/             # Login, Lobby, MatchScreen, Results, panels/*
├── components/        # Canvas (tło, podgląd postaci, awatar), ikony, UI
└── store/useGame.ts   # Zustand: ekran, profil, ostatni mecz
supabase/schema.sql    # cały backend SQL
```

## 9. Sterowanie
| Akcja | Klawiatura | Dotyk |
|---|---|---|
| Ruch | strzałki / WASD | krzyżak (obsługuje skosy) |
| Rzut / wsad (z piłką) | Spacja / J (przytrzymaj = celownik) | przycisk „rzut” / „wsad” (przytrzymaj) |
| Przechwyt / blok (w obronie) | Spacja / J | ten sam przycisk („przechwyt” / „blok”) |
| Powershot | E / K | przycisk POWER (świeci, gdy naładowany) |
| Zwód | Shift / L | przycisk „zwód” |
| Pauza | Esc / P | ⏸ |

Nad graczem z piłką widać aktualną szansę trafienia (zielona/żółta/czerwona, „3PT” za łukiem).

## 10. Konta i dostępy
| Serwis | Login | Gdzie hasło |
|---|---|---|
| Supabase | _(uzupełnij)_ | menedżer haseł |
| Vercel | _(uzupełnij)_ | menedżer haseł |
