# Bestiariusz Śródziemia

Lokalne narzędzie Mistrzyni Wiedzy do prowadzenia walk w Jedynym Pierścieniu: generator i biblioteka przeciwników, arkusze bojowe bohaterów oraz losowana mapa z żetonami.

## Uruchomienie

W katalogu projektu uruchom `python3 -m http.server 8765`, następnie otwórz http://localhost:8765. Aplikacja nie wymaga budowania ani backendu. Po pierwszym pełnym wczytaniu zasoby aplikacji są dostępne offline. Fonty internetowe mają lokalne odpowiedniki zastępcze.

## Korzystanie

- W zakładce **Bohaterowie** utwórz i edytuj arkusze; dodawaj bohaterów do potyczki na mapie.
- Przeciwników dodawaj z generatora lub biblioteki. Każdy uczestnik otrzymuje żeton po wygenerowaniu mapy.
- Na ekranie dotykowym przesuwaj mapę dwoma palcami, a gestem szczypania zmieniaj powiększenie. Jeden palec służy do wybierania i przeciągania żetonów.
- W zakładce **Potyczka** wybierz scenerię i rozmiar, a następnie wygeneruj teren. Przeciągaj żetony oraz tło planszy; używaj przybliżania i dopasowania widoku.
- Zmiany zasobów bohaterów pozostają na arkuszach po zakończeniu starcia. Teren nie wpływa automatycznie na zasady gry.
- „Wyczyść potyczkę” w zakładce **Potyczka** usuwa mapę i uczestników, zachowując arkusze bohaterów oraz bibliotekę. Widok **Aktywna walka** jest tymczasowo wyłączony.
- Przyciski pod zakładkami eksportują i przywracają pełną kopię danych. Import w bibliotece służy wyłącznie dodawaniu przeciwników.

Dane są zapisane w tej przeglądarce, dla adresu aplikacji. Pełna kopia JSON pozwala przenieść je na inne urządzenie. Przywrócenie kopii zastępuje wszystkie bieżące dane. Dotychczasowe klucze lokalnego zapisu pozostają zachowane podczas migracji.

## Sprawdzenie

Testy bez dodatkowych zależności: `node --test tests/*.test.js`.

Test przeglądarkowy: `node tests/browser-smoke.cjs` przy uruchomionym serwerze. Wymaga dostępnego pakietu `playwright` (lokalnie albo przez `NODE_PATH`) i Chrome. Opcjonalne zmienne: `BASE_URL`, `CHROME_PATH`, `SCREENSHOT_DIR`. Test używa oddzielnych kontekstów przeglądarki i nie zmienia danych użytkownika.

Test pełnego arkusza i układu responsywnego: `node tests/hero-sheet.cjs` (te same wymagania Playwright/Chrome; osobny kontekst i dane testowe).

Test panelu bohatera na mapie: `node tests/map-hero-panel.cjs` (Playwright/Chrome; izolowane dane). Sprawdza współdzielone zasoby i stany oraz nawigację po bohaterach według postawy i po przeciwnikach alfabetycznie.

Interfejs wspólnego stanu opisuje [STATE_API.md](STATE_API.md).

Test gestów mapy: `node tests/map-touch.cjs` (Playwright/Chrome; izolowane dane i zdarzenia dotykowe CDP).

Scenerie map: Las, Polana, Ruiny, Jaskinia, Las z polaną, Leśne rozstaje, Trakt, Rzeka, Rzeka z brodem, Bagna i Skalisty wąwóz. Ścieżki i woda są elementami wizualnymi; nie blokują przesuwania żetonów. Nowe układy powstają po wygenerowaniu mapy — zapisane mapy nie zmieniają się po aktualizacji.

Test scenerii: `node tests/map-scenes.cjs` (Playwright/Chrome; izolowane dane, generowanie, przeładowanie i przywracanie kopii).

Generowanie losuje również układ scenerii: las bez drogi, ze ścieżką lub traktem; polanę z 1–3 wejściami; rozstaje Y lub X; trakt i wąwóz także po przekątnej; kamieniste brzegi rzeki po jednej lub obu stronach; ruiny z nieregularną zabudową wokół traktu, placu lub długiego muru. Warianty są niezależne i mogą się powtarzać, a to samo ziarno daje identyczny układ.

Ruiny mają nieregularne układy: zabudowę wzdłuż traktu, otwarty plac lub długi mur z przerwami. Budowle różnią się kształtem, rozmiarem i orientacją; przejścia pozostają wolne od gruzu.

Przycisk w prawym górnym rogu mapy rozwija ją na całe okno; ponowne kliknięcie lub Escape przywraca zwykły widok. Test: `node tests/map-fullscreen.cjs` (izolowany Playwright/Chrome, komputer i telefon).

## Rzuty kośćmi

Przycisk „Rzuć kośćmi” otwiera nakładkę nad dowolną zakładką (jest ukryty na mapie pełnoekranowej). Wybierz Bohatera lub Wroga, pulę, stan Kości Działania i ręczne modyfikatory. PT jest opcjonalny. „Przygotuj kolejny rzut” zachowuje ustawienia do zamknięcia strony. Wydanie Nadziei w rollerze nie zmienia arkusza. Strzałka przy nagłówku „Rzut” zwija ustawienia, pozostawiając pulę, podgląd i przycisk rzutu. Powrót z wyniku zachowuje stan zwinięcia, a zamknięcie i ponowne otwarcie nakładki przywraca rozwinięty widok.

Moduł jest odseparowany: `dice-rules.js` zawiera czyste reguły, `dice-engine.js` adapter lokalnego Dice Box 1.1.4, a `dice-roller.js` i `dice-roller.css` nakładkę. `DiceRoller.open()` / `close()` umożliwiają otwieranie z przyszłych modułów. Wynik pochodzi z symulacji 3D, bez osobnego losowania. Symbole automatycznego sukcesu nie dodają liczby do sumy; zapewniają sukces niezależnie od sumy, także bez wpisanego PT. Oko Przygnębionego Bohatera powoduje porażkę, gdy jest wybraną Kością Działania.

Biblioteka, WASM i oba motywy są lokalne i objęte pamięcią offline. Kości są wyświetlane na przezroczystej warstwie nad całym oknem, również nad panelem rzutu i wyniku; warstwa przepuszcza kliknięcia do przycisków. Rozmiar kości jest dobierany przy rzucie do stałej wielkości na ekranie (około 60 px), niezależnie od wysokości okna, panelu i gęstości Retina. Kości mają zwiększoną masę oraz tłumienie ruchu. Silnik wczytuje się przy pierwszym rzucie; wymaga WebGL. Przy błędzie wyświetla komunikat, bez zastępowania rzutu innym losowaniem. Premia/kara ma zakres −6…+6; maksymalna pula to 14 kości sukcesu i 2 kości działania.

Test modułu w izolowanym Chrome: `node tests/dice-roller.cjs` (zmienne środowiska jak dla smoke testu). Test skali kości w różnych oknach i dużej puli na telefonie: `node tests/dice-size.cjs`. Test zwijania i pamięci widoku: `node tests/dice-collapse.cjs`. Test natywnej rozdzielczości ekranu (DPR 1/2/3, Retina), zmiany rozmiaru i kolejnych rzutów: `node tests/dice-resolution.cjs`. Atlas symboli można odtworzyć przez `node scripts/dice-textures.cjs` z dostępnym Playwright; nie jest to wymagane do uruchomienia aplikacji.
