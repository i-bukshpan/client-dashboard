## 🔧 הגדרת מסד הנתונים להיסטוריה ווולידציה

לפני שתוכל להשתמש בתכונות History ו-Validation, צריך להריץ את הסקריפט SQL הבא ב-Supabase.

### שלבים:

1. **היכנס ל-Supabase Dashboard**
   - לך ל-https://app.supabase.com
   - בחר את הפרויקט שלך

2. **פתח את SQL Editor**
   - בתפריט הצד, לחץ על "SQL Editor"
   - לחץ על "New query"

3. **העתק והדבק את הקוד SQL**
   - פתח את הקובץ `database/schema-updates.sql`
   - העתק את כל התוכן
   - הדבק ב-SQL Editor

4. **הרץ את הסקריפט**
   - לחץ על "RUN" (או Ctrl+Enter)
   - אמור להופיע: "Database schema created successfully!"

5. **וודא שהטבלאות נוצרו**
   - לך ל-"Table Editor"
   - בדוק שקיימות הטבלאות הבאות:
     - ✅ `record_history`
     - ✅ `validation_rules`
     - ✅ `table_relationships`

### מה נוצר?

#### טבלת `record_history`
- שומרת כל שינוי שנעשה ברשומות
- מעקב: מי שינה, מה שינה, מתי
- תומכת ב-create, update, delete

#### טבלת `validation_rules`
- מאחסנת כללי וולידציה לשדות
- תומך: required, min, max, pattern, email, phone, url
- ניתן להפעיל/לכבות כללים

#### טבלת `table_relationships`
- מגדירה קשרים בין טבלאות
- תומך: 1:1, 1:N, N:M
- (לשימוש עתידי)

#### עדכון ב-`clients`
- הוסף שדה `is_favorite` (Boolean)
- הוסף שדה `last_data_update` (Timestamp)

---

## 🎯 איך להשתמש

### צפייה בהיסטוריה של רשומה

1. פתח טבלה כלשהי (לקוחות/תשלומים/וכו')
2. במשבצת "פעולות", תראה אייקון סגול של שעון (History)
3. לחץ עליו
4. יפתח דיאלוג עם timeline של כל השינויים

### הוספת כלל Validation (בהמשך)

כרגע הפונקציונליות קיימת ב-backend. נוסיף UI בהמשך.

---

## 🐛 פתרון בעיות

**שגיאה: "relation 'record_history' does not exist"**
- לא הרצת את ה-SQL script
- הרץ את `database/schema-updates.sql`

**שגיאה: "permission denied"**
- בדוק RLS policies
- הסקריפט אמור ליצור policies אוטומטית

**לא רואה היסטוריה**
- שינויים נרשמים רק **החל מעכשיו**
- שינויים שנעשו לפני הרצת הסקריפט לא נרשמו
