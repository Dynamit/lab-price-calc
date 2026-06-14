# מחשבון מחירי מעבדה — אסותא עד הבית

אתר סטטי (HTML/CSS/JS, ללא build) לחישוב הצעות מחיר לבדיקות מעבדה, עם ייצוא הצעת מחיר ללקוח ורשימת בדיקות לצוות.

**חי:** https://dynamit.github.io/lab-price-calc/

## הרצה מקומית

ה-`fetch` של קבצי ה-JSON דורש שרת — אין לפתוח את `index.html` ישירות (`file://`).

```bash
python -m http.server 8000      # או: npx serve -l 8000
```

ואז לפתוח http://localhost:8000 (לרענון אחרי שינוי: `Ctrl+F5`).

## מבנה

| נתיב | תפקיד |
|------|-------|
| `index.html` / `style.css` / `script.js` | האפליקציה |
| `assets/data/lab_prices.json` | מחירון (זהה לשני הסניפים) |
| `assets/data/lab_details.json` | ספר בדיקות — רמת החייל (6 שדות) |
| `assets/data/lab_details_haifa.json` | ספר בדיקות — חיפה (10 שדות) |
| `tools/build_data.py` | ממיר את קובצי ה-Excel ל-JSON |

הבדיקות ממופתחות לפי **קוד תפנית**, כך שמחיר ופרטים מתאימים. בורר המעבדה משנה רק איזה ספר פרטים מוצג — לא את המחירים. חובה לבחור מעבדה **וגם** מחירון לפני שאפשר להתחיל.

## עדכון נתונים (מחירון / ספרי בדיקות)

הנתונים נוצרים מקובצי Excel שאינם נשמרים ב-repo (`*.xlsx` מוחרגים ב-`.gitignore`) — רק ה-JSON שנוצר נשמר.

1. להניח את קובץ ה-Excel החדש בתיקיית השורש של הפרויקט.
2. לעדכן את שם הקובץ המתאים ב-`CONFIG` שבראש `tools/build_data.py`.
3. להריץ:
   ```bash
   pip install openpyxl      # פעם אחת
   python tools/build_data.py
   ```
4. לבדוק `git diff` על `assets/data/*.json`, ואז לעשות commit.

מיפוי העמודות (אילו עמודות באקסל הופכות לאילו שדות) מתועד בתוך `build_data.py`.

## פרסום (Deploy)

האתר מתפרסם אוטומטית דרך **GitHub Pages מענף `main`**. כל merge ל-`main` בונה מחדש את האתר (כדקה) ומעדכן את הלינק החי. **PR לבד לא מעדכן את הלינק** — צריך merge ל-`main`.

## הערה למפתחים

אין כלי דפדפן אוטומטיים מותקנים. אפשר לאמת את `script.js` ע"י הרצתו ב-`node` בתוך `vm` עם stub ל-DOM/fetch/localStorage (כפי שנעשה במהלך הפיתוח).
