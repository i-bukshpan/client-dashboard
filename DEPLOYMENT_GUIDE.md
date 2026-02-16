# מדריך העלאת האתר לרשת (Deployment Guide)

המדריך הזה יעזור לך להעלות את האתר ל-GitHub ולחבר אותו ל-Vercel כדי לקבל קישור שתוכל לשתף עם הלקוחות שלך.

## שלב א': הכנת הפרויקט והעלאה ל-GitHub

1.  **יצירת מאגר (Repository) ב-GitHub**:
    *   היכנס ל-[GitHub](https://github.com) וצור Repository חדש.
    *   תן לו שם (למשל `client-dashboard`).
    *   אל תוסיף קובצי README או .gitignore (אנחנו נוסיף אותם מהמחשב).

2.  **חיבור הפרויקט במחשב ל-GitHub** (פתח את הטרמינל בתיקיית הפרויקט):
    ```bash
    git init
    git add .
    git commit -m "Initial commit"
    git branch -M main
    git remote add origin [הקישור שקיבלת מ-GitHub]
    git push -u origin main
    ```

3.  **אימות**: וודא שב-GitHub אתה רואה את כל הקבצים (חשוב: קובץ `.env` **לא** אמור לעלות לשם).

---

## שלב ב': העלאה לאוויר ב-Vercel (קבלת קישור ללקוח)

1.  היכנס ל-[Vercel](https://vercel.com) והתחבר עם חשבון ה-GitHub שלך.
2.  לחץ על **Add New** ואז על **Project**.
3.  בחר את ה-Repository שיצרת בשלב א' ולחץ על **Import**.
4.  **הגדרת Environment Variables** (חשוב מאוד!):
    *   במסך ההגדרה תראה סעיף שנקרא **Environment Variables**.
    *   תצטרך להעתיק לשם את הערכים מקובץ ה-`.env` שבמחשב שלך:
        *   `NEXT_PUBLIC_SUPABASE_URL` = [הקישור מהקובץ]
        *   `NEXT_PUBLIC_SUPABASE_ANON_KEY` = [המפתח מהקובץ]
5.  לחץ על **Deploy**. תוך כדקה תקבל קישור זמני/קבוע (למשל `client-dashboard.vercel.app`) שתוכל לשלוח ללקוח.

---

## שלב ג': עדכון שינויים בעתיד

בכל פעם שתעשה שינויים בקוד ותרצה שהם יתעדכנו באתר החי, פשוט הרץ את הפקודות הבאות בטרמינל:

```bash
git add .
git commit -m "עדכנתי את דף התקשורת"
git push origin main
```

**Vercel יזהה את העדכון באופן אוטומטי ויעדכן את האתר תוך כדקה.**

---

### הערות חשובות:
*   **אבטחה**: לעולם אל תעלה את קובץ ה-`.env` ל-GitHub. הוא מכיל מפתחות פרטיים.
*   **בסיס נתונים**: האתר המועלה ימשיך להשתמש ב-Supabase הנוכחי שלך, כך שכל הנתונים שאתה רואה עכשיו יופיעו גם באתר החי.
