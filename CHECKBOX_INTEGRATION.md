# Інтеграція Checkbox

У проекті додано базове серверне підключення до Checkbox API. Секретні дані зберігаються лише в `server/.env`; Angular звертається до захищеного proxy `/api/checkbox`.

## Що вже працює

- read-only каталог Checkbox в адмінці товарів з міткою `CHECKBOX`;
- read-only фіскальні чеки Checkbox на сторінці продажів з окремою міткою;
- ручна фіскалізація повністю оплаченого продажу сайту;
- opt-in автофіскалізація повністю оплаченого checkout-замовлення;
- перетворення сум Checkbox з копійок, а кількості — з тисячних часток одиниці;
- стабільний UUID чека для захисту від дублювання при повторному запиті.

## Які дані потрібні

1. `CHECKBOX_CASHIER_PIN` — PIN касира для рекомендованої в цьому проекті PIN-авторизації. Використовується разом із `CHECKBOX_LICENSE_KEY`.
2. `CHECKBOX_CASHIER_LOGIN` і `CHECKBOX_CASHIER_PASSWORD` — альтернативна авторизація. Вони не потрібні, якщо вказано PIN. Увійдіть у [кабінет Checkbox](https://my.checkbox.ua), відкрийте **Касири**, створіть або виберіть API-касира.
3. `CHECKBOX_LICENSE_KEY` — ключ ліцензії каси. У кабінеті відкрийте **Каси**, виберіть потрібну тестову або бойову касу й скопіюйте ключ ліцензії.
4. `CHECKBOX_ACCESS_KEY` — необов'язковий ключ конкретної інтеграції. Поточна документація Checkbox позначає його як такий, що зараз не використовується. Заповнюйте лише якщо його видасть підтримка Checkbox.

Також потрібні зареєстровані **торгова точка, каса й касир**, активний підпис касира (Checkbox.Підпис або хмарний DepositSign/HSM) і відкрита касова зміна. Для бойової роботи вони мають бути зареєстровані в ДПС. Не тестуйте на бойовій касі.

## Налаштування

Скопіюйте поля з `.env.example` у `.env`:

```env
CHECKBOX_API_URL=https://api.checkbox.ua
CHECKBOX_CASHIER_LOGIN=
CHECKBOX_CASHIER_PASSWORD=
CHECKBOX_CASHIER_PIN=
CHECKBOX_LICENSE_KEY=
CHECKBOX_ACCESS_KEY=
CHECKBOX_CLIENT_NAME=Urban Nest
CHECKBOX_CLIENT_VERSION=1.0.0
CHECKBOX_AUTO_FISCALIZE=false
```

Спочатку залиште `CHECKBOX_AUTO_FISCALIZE=false`, перевірте каталог, чеки й ручну фіскалізацію на тестовій касі. Після успішної перевірки можна ввімкнути `true`.

Автофіскалізація запускається лише коли `payment.status === "paid"`. Замовлення з післяплатою не фіскалізуються в момент checkout: їх треба фіскалізувати після фактичної оплати або окремо реалізувати сценарій Checkbox ЕТТН/передплати-післяплати.

## Офіційна документація

- [Специфікація Checkbox API](https://wiki.checkbox.ua/uk/api)
- [Актуальний Swagger](https://api.checkbox.in.ua/api/docs)
- [Підключення через API](https://checkbox.ua/api-integration/)
