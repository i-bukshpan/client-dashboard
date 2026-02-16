'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  HelpCircle, Users, Tag, FileText, Calendar, BarChart3, Settings, 
  CheckSquare, Globe, LayoutDashboard, Target, 
  MessageSquare, ArrowRight
} from 'lucide-react'
import Link from 'next/link'

export default function HelpPage() {
  return (
    <div className="p-8" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-navy mb-2">מדריך עזרה מקיף</h1>
        <p className="text-grey">למד על כל הדפים והפונקציות במערכת</p>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 mb-6 h-auto overflow-x-auto">
          <TabsTrigger value="dashboard" className="gap-2 text-xs">
            <LayoutDashboard className="h-4 w-4" />
            לוח בקרה
          </TabsTrigger>
          <TabsTrigger value="client" className="gap-2 text-xs">
            <Users className="h-4 w-4" />
            פרטי לקוח
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2 text-xs">
            <Calendar className="h-4 w-4" />
            לוח זמנים
          </TabsTrigger>
          <TabsTrigger value="goals" className="gap-2 text-xs">
            <Target className="h-4 w-4" />
            יעדים
          </TabsTrigger>
          <TabsTrigger value="communication" className="gap-2 text-xs">
            <MessageSquare className="h-4 w-4" />
            תקשורת
          </TabsTrigger>
          <TabsTrigger value="statistics" className="gap-2 text-xs">
            <BarChart3 className="h-4 w-4" />
            סטטיסטיקות
          </TabsTrigger>
          <TabsTrigger value="view" className="gap-2 text-xs">
            <Globe className="h-4 w-4" />
            שיתוף לקוח
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-start gap-4 mb-4">
              <LayoutDashboard className="h-8 w-8 text-blue-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h2 className="text-2xl font-semibold mb-2">לוח בקרה ראשי</h2>
                <p className="text-grey mb-4">הדף הראשי של המערכת - ניהול וצפייה בכל הלקוחות</p>
                <Link href="/" className="text-blue-600 hover:underline flex items-center gap-1 text-sm">
                  לעבור לדף <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            <div className="space-y-4 mt-6">
              <div className="border-t pt-4">
                <h3 className="font-semibold text-lg mb-3">פונקציות עיקריות:</h3>
                
                <div className="space-y-3">
                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-600" />
                      הצגת לקוחות
                    </h4>
                    <p className="text-sm text-grey">צפה בכל הלקוחות בכרטיסים מסודרים. כל כרטיס מציג שם, יתרה נוכחית, הכנסה והוצאה חודשית, ותגיות.</p>
                  </div>

                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <span className="text-lg">🔍</span>
                      חיפוש לקוחות
                    </h4>
                    <p className="text-sm text-grey mb-2">חפש לקוחות לפי:</p>
                    <ul className="list-disc list-inside text-sm text-grey space-y-1 mr-4">
                      <li>שם הלקוח</li>
                      <li>כתובת אימייל</li>
                      <li>מספר טלפון</li>
                    </ul>
                  </div>

                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <span className="text-lg">🔽</span>
                      סינון לקוחות
                    </h4>
                    <p className="text-sm text-grey mb-2">סנן לקוחות לפי:</p>
                    <ul className="list-disc list-inside text-sm text-grey space-y-1 mr-4">
                      <li>סטטוס (פעיל, ליד, ארכיון)</li>
                      <li>תגיות (אם יש תגיות במערכת)</li>
                    </ul>
                  </div>

                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-blue-600" />
                      מיון לקוחות
                    </h4>
                    <p className="text-sm text-grey mb-2">מיין לפי:</p>
                    <ul className="list-disc list-inside text-sm text-grey space-y-1 mr-4">
                      <li>תאריך יצירה (חדש/ישן)</li>
                      <li>שם (א-ב או ב-א)</li>
                      <li>יתרה (גבוה/נמוך)</li>
                    </ul>
                  </div>

                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <CheckSquare className="h-4 w-4 text-emerald" />
                      פעולות מרובות
                    </h4>
                    <p className="text-sm text-grey mb-3">בחר מספר לקוחות ובצע פעולות על כולם יחד:</p>
                    <ul className="list-disc list-inside text-sm text-grey space-y-1 mr-4">
                      <li>לחץ על "בחר מרובים" כדי להפעיל מצב בחירה</li>
                      <li>סמן את הלקוחות שברצונך לבחור</li>
                      <li>עדכן סטטוס - שנה סטטוס למספר לקוחות בבת אחת</li>
                      <li>הוסף תגיות - הקצה תגיות למספר לקוחות</li>
                      <li>ייצא נתונים - ייצא נתונים של הלקוחות הנבחרים</li>
                      <li>מחק - מחק מספר לקוחות בבת אחת (זהירות!)</li>
                    </ul>
                  </div>

                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-600" />
                      הוספת לקוח חדש
                    </h4>
                    <p className="text-sm text-grey">לחץ על כפתור "הוסף לקוח חדש" כדי ליצור לקוח חדש במערכת. תצטרך להזין שם, אימייל (אופציונלי), טלפון (אופציונלי) וסטטוס.</p>
                  </div>

                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <span className="text-lg">📊</span>
                      התראות ומשימות קרובות
                    </h4>
                    <p className="text-sm text-grey mb-2">בחלק העליון של הדף תוכל לראות:</p>
                    <ul className="list-disc list-inside text-sm text-grey space-y-1 mr-4">
                      <li>תשלומים ממתינים - תשלומים שטרם שולמו</li>
                      <li>משימות קרובות - תזכורות ומשימות ב-7 הימים הקרובים</li>
                    </ul>
                    <p className="text-sm text-grey mt-2">לחץ על כל התראה כדי לעבור ישירות לדף הלקוח הרלוונטי.</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Client Detail Tab */}
        <TabsContent value="client" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-start gap-4 mb-4">
              <Users className="h-8 w-8 text-blue-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h2 className="text-2xl font-semibold mb-2">עמוד פרטי לקוח</h2>
                <p className="text-grey mb-4">ניהול מפורט של כל המידע על לקוח ספציפי</p>
              </div>
            </div>

            <div className="space-y-4 mt-6">
              <div className="border-t pt-4">
                <h3 className="font-semibold text-lg mb-3">טאבים ופונקציות:</h3>
                
                <div className="space-y-3">
                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">📋 טבלאות דינמיות</h4>
                    <p className="text-sm text-grey mb-2">כל לקוח יכול להכיל מספר טבלאות מותאמות אישית:</p>
                    <ul className="list-disc list-inside text-sm text-grey space-y-1 mr-4">
                      <li>צור טבלאות חדשות עם עמודות מותאמות</li>
                      <li>הוסף נתונים לטבלאות</li>
                      <li>ערוך ומחק רשומות</li>
                      <li>השתמש בעמודות מחושבות ונוסחאות</li>
                      <li>קשר בין טבלאות (lookup/reference)</li>
                      <li>עיצוב מותנה (conditional formatting)</li>
                    </ul>
                  </div>

                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">👁️ תצוגות מותאמות</h4>
                    <p className="text-sm text-grey mb-2">שמור תצוגות שונות לכל טבלה:</p>
                    <ul className="list-disc list-inside text-sm text-grey space-y-1 mr-4">
                      <li>בחר אילו עמודות להציג</li>
                      <li>הגדר סדר עמודות</li>
                      <li>שמור סינונים ומיון</li>
                      <li>טען תצוגות שמורות</li>
                      <li>מחק תצוגות</li>
                    </ul>
                    <p className="text-sm text-grey mt-2">לחץ על "שמור תצוגה נוכחית" כדי לשמור את ההגדרות הנוכחיות.</p>
                  </div>

                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">💰 תשלומים</h4>
                    <p className="text-sm text-grey mb-2">נהל תשלומים עבור הלקוח:</p>
                    <ul className="list-disc list-inside text-sm text-grey space-y-1 mr-4">
                      <li>הוסף תשלומים חדשים</li>
                      <li>עדכן סטטוס תשלום (שולם/ממתין)</li>
                      <li>עקוב אחר תאריכי תשלום</li>
                      <li>צפה בהיסטוריית תשלומים</li>
                    </ul>
                  </div>

                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">📝 פתקים</h4>
                    <p className="text-sm text-grey mb-2">פתקים דביקים (Sticky Notes):</p>
                    <ul className="list-disc list-inside text-sm text-grey space-y-1 mr-4">
                      <li>כתוב הערות ומידע חשוב על הלקוח</li>
                      <li>הערות נשמרות אוטומטית</li>
                      <li>נראות רק לך (לא ללקוח)</li>
                    </ul>
                  </div>

                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">⏰ תזכורות</h4>
                    <p className="text-sm text-grey mb-2">נהל תזכורות ומשימות:</p>
                    <ul className="list-disc list-inside text-sm text-grey space-y-1 mr-4">
                      <li>צור תזכורות חדשות עם תאריך יעד</li>
                      <li>הגדר עדיפות (גבוהה, בינונית, נמוכה)</li>
                      <li>סמן תזכורות כהושלמו</li>
                      <li>צפה בתזכורות קרובות</li>
                    </ul>
                  </div>

                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">🔐 סיסמאות</h4>
                    <p className="text-sm text-grey mb-2">נהל פרטי גישה מוצפנים:</p>
                    <ul className="list-disc list-inside text-sm text-grey space-y-1 mr-4">
                      <li>שמור שמות משתמש וסיסמאות</li>
                      <li>הצג/הסתר סיסמאות</li>
                      <li>העתק פרטים ללוח</li>
                      <li>מחק פרטי גישה</li>
                    </ul>
                  </div>

                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">⚙️ הגדרות</h4>
                    <p className="text-sm text-grey mb-2">בטאב הגדרות תוכל:</p>
                    <ul className="list-disc list-inside text-sm text-grey space-y-1 mr-4">
                      <li>ערוך פרטי לקוח (שם, אימייל, טלפון, סטטוס)</li>
                      <li>ניהול טבלאות - צור, ערוך, מחק טבלאות</li>
                      <li>הגדר מבנה טבלה (עמודות, סוגי נתונים)</li>
                      <li>שמור טבלה כטבלת ברירת מחדל</li>
                    </ul>
                  </div>

                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">🔗 שיתוף לקוח</h4>
                    <p className="text-sm text-grey mb-2">שתף גישה לקוח:</p>
                    <ul className="list-disc list-inside text-sm text-grey space-y-1 mr-4">
                      <li>צור קישור שיתוף ייחודי</li>
                      <li>הלקוח יוכל לראות את התשלומים שלו דרך הקישור</li>
                      <li>הקישור מאובטח עם token ייחודי</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-start gap-4 mb-4">
              <Calendar className="h-8 w-8 text-green-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h2 className="text-2xl font-semibold mb-2">לוח זמנים כללי</h2>
                <p className="text-grey mb-4">תצוגה מרכזית של כל המשימות והתזכורות</p>
                <Link href="/calendar" className="text-blue-600 hover:underline flex items-center gap-1 text-sm">
                  לעבור לדף <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            <div className="space-y-4 mt-6">
              <div className="border-t pt-4">
                <h3 className="font-semibold text-lg mb-3">פונקציות:</h3>
                
                <div className="space-y-3">
                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">📅 לוח שנה חודשי</h4>
                    <p className="text-sm text-grey mb-2">צפה בכל התזכורות והמשימות בלוח שנה:</p>
                    <ul className="list-disc list-inside text-sm text-grey space-y-1 mr-4">
                      <li>כל תאריך מציג את התזכורות הקשורות אליו</li>
                      <li>תאריך היום מסומן בצבע ירוק</li>
                      <li>תזכורות מאוחרות מודגשות</li>
                      <li>לחיצה על תזכורת מעבירה לדף הלקוח</li>
                    </ul>
                  </div>

                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">🔄 ניווט בין חודשים</h4>
                    <p className="text-sm text-grey mb-2">השתמש בכפתורים כדי לנווט:</p>
                    <ul className="list-disc list-inside text-sm text-grey space-y-1 mr-4">
                      <li>חודש קודם - עבר לחודש הקודם</li>
                      <li>חודש הבא - עבר לחודש הבא</li>
                      <li>היום - חזור לחודש הנוכחי</li>
                    </ul>
                  </div>

                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">📋 רשימת תזכורות לחודש</h4>
                    <p className="text-sm text-grey mb-2">בחלק התחתון תוכל לראות רשימה מפורטת של כל התזכורות לחודש:</p>
                    <ul className="list-disc list-inside text-sm text-grey space-y-1 mr-4">
                      <li>כותרת התזכורת</li>
                      <li>לקוח קשור (לחיצה מעבר לדף הלקוח)</li>
                      <li>תאריך יעד</li>
                      <li>עדיפות (דחוף/רגיל/נמוך)</li>
                    </ul>
                  </div>

                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">🎨 צבעים ועדיפויות</h4>
                    <p className="text-sm text-grey mb-2">התזכורות מסומנות בצבעים שונים:</p>
                    <ul className="list-disc list-inside text-sm text-grey space-y-1 mr-4">
                      <li>אדום - תזכורות דחופות</li>
                      <li>כחול - תזכורות רגילות</li>
                      <li>אפור - תזכורות שהושלמו</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Goals Tab */}
        <TabsContent value="goals" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-start gap-4 mb-4">
              <Target className="h-8 w-8 text-purple-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h2 className="text-2xl font-semibold mb-2">מעקב מטרות ויעדים</h2>
                <p className="text-grey mb-4">הגדר ועקוב אחר יעדים עסקיים</p>
                <Link href="/goals" className="text-blue-600 hover:underline flex items-center gap-1 text-sm">
                  לעבור לדף <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            <div className="space-y-4 mt-6">
              <div className="border-t pt-4">
                <h3 className="font-semibold text-lg mb-3">פונקציות:</h3>
                
                <div className="space-y-3">
                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">➕ יצירת יעד חדש</h4>
                    <p className="text-sm text-grey mb-2">לחץ על "הוסף יעד חדש" והגדר:</p>
                    <ul className="list-disc list-inside text-sm text-grey space-y-1 mr-4">
                      <li>סוג יעד - הכנסות, מספר לקוחות, מספר תשלומים, או מותאם אישית</li>
                      <li>כותרת - שם היעד</li>
                      <li>סכום יעד - הערך שאליו רוצים להגיע</li>
                      <li>תאריך יעד - מתי רוצים להשיג את היעד</li>
                      <li>תיאור - פרטים נוספים (אופציונלי)</li>
                    </ul>
                  </div>

                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">📊 מעקב התקדמות</h4>
                    <p className="text-sm text-grey mb-2">כל כרטיס יעד מציג:</p>
                    <ul className="list-disc list-inside text-sm text-grey space-y-1 mr-4">
                      <li>סטטוס - פעיל, הושג, נכשל, בוטל</li>
                      <li>אחוז התקדמות - כמה מהערך הנוכחי הושג</li>
                      <li>פס התקדמות ויזואלי</li>
                      <li>ערך נוכחי vs ערך יעד</li>
                      <li>תאריך יעד</li>
                    </ul>
                    <p className="text-sm text-grey mt-2">ההתקדמות מתעדכנת אוטומטית כל דקה.</p>
                  </div>

                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">✏️ עריכת יעדים</h4>
                    <p className="text-sm text-grey">לחץ על כפתור העריכה כדי לעדכן פרטי יעד. ניתן לשנות כל פרט מלבד ה-ID.</p>
                  </div>

                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">🗑️ מחיקת יעדים</h4>
                    <p className="text-sm text-grey">לחץ על כפתור המחיקה כדי למחוק יעד. הפעולה דורשת אישור.</p>
                  </div>

                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">🎯 סוגי יעדים</h4>
                    <p className="text-sm text-grey mb-2">ניתן להגדיר יעדים מסוגים שונים:</p>
                    <ul className="list-disc list-inside text-sm text-grey space-y-1 mr-4">
                      <li>הכנסות - יעד לסכום הכנסות כולל</li>
                      <li>מספר לקוחות - יעד למספר לקוחות במערכת</li>
                      <li>מספר תשלומים - יעד למספר תשלומים כולל</li>
                      <li>מותאם אישית - יעד מותאם עם מעקב ידני</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Communication Tab */}
        <TabsContent value="communication" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-start gap-4 mb-4">
              <MessageSquare className="h-8 w-8 text-green-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h2 className="text-2xl font-semibold mb-2">תקשורת מרכזית</h2>
                <p className="text-grey mb-4">שליחת הודעות ללקוחות דרך WhatsApp</p>
                <Link href="/communication" className="text-blue-600 hover:underline flex items-center gap-1 text-sm">
                  לעבור לדף <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            <div className="space-y-4 mt-6">
              <div className="border-t pt-4">
                <h3 className="font-semibold text-lg mb-3">פונקציות:</h3>
                
                <div className="space-y-3">
                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">💬 שליחת הודעה מרובת נמענים</h4>
                    <p className="text-sm text-grey mb-2">שלח הודעה למספר לקוחות בו-זמנית:</p>
                    <ul className="list-disc list-inside text-sm text-grey space-y-1 mr-4">
                      <li>בחר לקוחות מתוך הרשימה (ניתן לבחור כמה שתרצה)</li>
                      <li>סנן לקוחות לפי סטטוס (הכל, פעיל, ליד, ארכיון)</li>
                      <li>לחץ על "בחר הכל" כדי לבחור את כל הלקוחות המוצגים</li>
                      <li>כתוב את ההודעה</li>
                      <li>לחץ על "שלח" - ההודעות יישלחו דרך WhatsApp</li>
                    </ul>
                    <p className="text-sm text-grey mt-2">הערה: רק לקוחות עם מספר טלפון יכולים לקבל הודעות.</p>
                  </div>

                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">💰 תזכורות תשלום</h4>
                    <p className="text-sm text-grey mb-2">בחלק הימני תוכל לראות רשימת תשלומים ממתינים:</p>
                    <ul className="list-disc list-inside text-sm text-grey space-y-1 mr-4">
                      <li>כל תשלום מציג שם לקוח, סכום ותאריך</li>
                      <li>לחץ על "שלח תזכורת" כדי לשלוח הודעת תזכורת אוטומטית</li>
                      <li>ההודעה תכלול שם לקוח, סכום ותאריך תשלום</li>
                    </ul>
                    <p className="text-sm text-grey mt-2">התזכורות נשלחות אוטומטית עם פורמט מוכן מראש.</p>
                  </div>

                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">📱 אינטגרציה עם WhatsApp</h4>
                    <p className="text-sm text-grey mb-2">המערכת משתמשת ב-WhatsApp Web לשליחת הודעות:</p>
                    <ul className="list-disc list-inside text-sm text-grey space-y-1 mr-4">
                      <li>ההודעות נפתחות בחלון חדש של WhatsApp</li>
                      <li>צריך להיות מחובר ל-WhatsApp Web</li>
                      <li>ההודעות מוכנות לשליחה - רק צריך ללחוץ Enter</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="statistics" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-start gap-4 mb-4">
              <BarChart3 className="h-8 w-8 text-blue-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h2 className="text-2xl font-semibold mb-2">דשבורד סטטיסטיקות</h2>
                <p className="text-grey mb-4">סקירה כללית של הפעילות העסקית</p>
                <Link href="/statistics" className="text-blue-600 hover:underline flex items-center gap-1 text-sm">
                  לעבור לדף <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            <div className="space-y-4 mt-6">
              <div className="border-t pt-4">
                <h3 className="font-semibold text-lg mb-3">פונקציות:</h3>
                
                <div className="space-y-3">
                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">📊 כרטיסי סיכום</h4>
                    <p className="text-sm text-grey mb-2">בחלק העליון תוכל לראות:</p>
                    <ul className="list-disc list-inside text-sm text-grey space-y-1 mr-4">
                      <li>סה"כ לקוחות - מספר כל הלקוחות</li>
                      <li>סה"כ הכנסות - סכום כל ההכנסות</li>
                      <li>תשלומים ממתינים - סכום תשלומים שטרם שולמו</li>
                      <li>ממוצע תשלום - ממוצע סכום תשלום</li>
                    </ul>
                  </div>

                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">📈 גרף הכנסות חודשיות</h4>
                    <p className="text-sm text-grey">גרף עמודות המציג את ההכנסות לפי חודש.</p>
                  </div>

                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">🥧 התפלגות לקוחות לפי סטטוס</h4>
                    <p className="text-sm text-grey">גרף עוגה המציג את החלוקה של הלקוחות לפי סטטוס (פעיל, ליד, ארכיון) עם אחוזים.</p>
                  </div>

                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">💳 התפלגות אמצעי תשלום</h4>
                    <p className="text-sm text-grey">גרף עמודות המציג את ההתפלגות של סכומי התשלומים לפי אמצעי תשלום.</p>
                  </div>

                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">📉 מגמת הכנסות</h4>
                    <p className="text-sm text-grey">גרף קו המציג את המגמה של ההכנסות לאורך זמן.</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* View/Share Tab */}
        <TabsContent value="view" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-start gap-4 mb-4">
              <Globe className="h-8 w-8 text-blue-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h2 className="text-2xl font-semibold mb-2">שיתוף לקוח (תצוגה ציבורית)</h2>
                <p className="text-grey mb-4">דף ציבורי המאפשר ללקוחות לצפות במידע שלהם</p>
              </div>
            </div>

            <div className="space-y-4 mt-6">
              <div className="border-t pt-4">
                <h3 className="font-semibold text-lg mb-3">איך זה עובד:</h3>
                
                <div className="space-y-3">
                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">🔗 יצירת קישור שיתוף</h4>
                    <p className="text-sm text-grey mb-2">מעמוד פרטי הלקוח:</p>
                    <ul className="list-disc list-inside text-sm text-grey space-y-1 mr-4">
                      <li>עבור לטאב "הגדרות" בדף הלקוח</li>
                      <li>בחלק "שיתוף לקוח" תראה אפשרות ליצור קישור שיתוף</li>
                      <li>לחץ על "צור קישור שיתוף"</li>
                      <li>הקישור יוצר אוטומטית עם token ייחודי ומאובטח</li>
                      <li>העתק את הקישור ושלח ללקוח</li>
                    </ul>
                  </div>

                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">👁️ מה הלקוח רואה</h4>
                    <p className="text-sm text-grey mb-2">הלקוח יכול לראות:</p>
                    <ul className="list-disc list-inside text-sm text-grey space-y-1 mr-4">
                      <li>פרטי לקוח בסיסיים - שם, אימייל, טלפון, סטטוס</li>
                      <li>תשלומים - רשימת כל התשלומים עם פרטים</li>
                      <li>הלקוח לא יכול לראות: פתקים, סיסמאות, תזכורות, או לערוך משהו</li>
                    </ul>
                  </div>

                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">🔒 אבטחה</h4>
                    <p className="text-sm text-grey mb-2">הקישור מאובטח:</p>
                    <ul className="list-disc list-inside text-sm text-grey space-y-1 mr-4">
                      <li>כל קישור כולל token ייחודי וארוך</li>
                      <li>בלתי אפשרי לנחש את ה-token</li>
                      <li>ניתן לבטל את הקישור בכל עת</li>
                      <li>הלקוח לא יכול לגשת למידע של לקוחות אחרים</li>
                    </ul>
                  </div>

                  <div className="bg-grey/5 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">❌ ביטול שיתוף</h4>
                    <p className="text-sm text-grey">לבטל קישור שיתוף, חזור לדף הלקוח ובטאב "הגדרות" לחץ על "בטל שיתוף". הקישור יהפוך לחסר תוקף מיד.</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

      </Tabs>


      {/* Tips Section */}
      <Card className="p-6 mt-8 bg-blue-50 border-blue-200">
        <h3 className="text-xl font-semibold mb-4">💡 טיפים ושימושיים</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium mb-2">חיפוש מהיר:</p>
            <p className="text-grey">השתמש בחיפוש הגלובלי בתפריט העליון כדי למצוא לקוחות במהירות</p>
          </div>
          <div>
            <p className="font-medium mb-2">תצוגות מותאמות:</p>
            <p className="text-grey">שמור תצוגות מותאמות לכל טבלה כדי לחזור אליהן בקלות</p>
          </div>
          <div>
            <p className="font-medium mb-2">תגיות:</p>
            <p className="text-grey">השתמש בתגיות לארגון לקוחות - ניתן להוסיף כמה תגיות לכל לקוח</p>
          </div>
          <div>
            <p className="font-medium mb-2">טבלאות ברירת מחדל:</p>
            <p className="text-grey">שמור טבלאות מוצלחות כברירת מחדל כדי להשתמש בהן אצל לקוחות אחרים</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
