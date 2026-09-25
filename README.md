# Bestiariusz Śródziemia

Lokalne narzędzie Mistrzyni Wiedzy do prowadzenia walk w Jedynym Pierścieniu: generator i biblioteka przeciwników, arkusze bojowe bohaterów oraz losowana mapa z żetonami.

## Uruchomienie

W katalogu projektu uruchom `python3 -m http.server 8765`, następnie otwórz http://localhost:8765. Aplikacja nie wymaga budowania ani backendu. Po pierwszym pełnym wczytaniu zasoby aplikacji są dostępne offline. Fonty internetowe mają lokalne odpowiedniki zastępcze.

## Korzystanie

- W zakładce **Bohaterowie** utwórz i edytuj arkusze; dodawaj bohaterów do aktywnej walki.
- Przeciwników dodawaj z generatora lub biblioteki. Każdy uczestnik otrzymuje żeton po wygenerowaniu mapy.
- W zakładce **Mapa** wybierz scenerię i rozmiar, a następnie wygeneruj teren. Przeciągaj żetony oraz tło planszy; używaj przybliżania i dopasowania widoku.
- Zmiany zasobów bohaterów pozostają na arkuszach po zakończeniu starcia. Teren nie wpływa automatycznie na zasady gry.
- Przyciski pod zakładkami eksportują i przywracają pełną kopię danych. Import w bibliotece służy wyłącznie dodawaniu przeciwników.

Dane są zapisane w tej przeglądarce, dla adresu aplikacji. Pełna kopia JSON pozwala przenieść je na inne urządzenie. Przywrócenie kopii zastępuje wszystkie bieżące dane. Dotychczasowe klucze lokalnego zapisu pozostają zachowane podczas migracji.

## Sprawdzenie

Testy bez dodatkowych zależności: `node --test tests/*.test.js`.

Test przeglądarkowy: `node tests/browser-smoke.cjs` przy uruchomionym serwerze. Wymaga dostępnego pakietu `playwright` (lokalnie albo przez `NODE_PATH`) i Chrome. Opcjonalne zmienne: `BASE_URL`, `CHROME_PATH`, `SCREENSHOT_DIR`. Test używa oddzielnych kontekstów przeglądarki i nie zmienia danych użytkownika.

Interfejs wspólnego stanu opisuje [STATE_API.md](STATE_API.md).
