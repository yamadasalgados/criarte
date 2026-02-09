export type Lang = "pt" | "en" | "ja";

const KEY = "criaarte_lang_v1";

export function getLang(): Lang {
  if (typeof window === "undefined") return "pt";
  const v = String(localStorage.getItem(KEY) || "").trim();
  return v === "en" || v === "ja" || v === "pt" ? v : "pt";
}

export function setLang(lang: Lang) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, lang);
  window.dispatchEvent(new CustomEvent("lang:changed", { detail: { lang } }));
}

export function onLangChanged(cb: (lang: Lang) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb(getLang());
  window.addEventListener("lang:changed", handler as any);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("lang:changed", handler as any);
    window.removeEventListener("storage", handler);
  };
}

const dict = {
  pt: {
    chat: "Chat",
    cart: "Carrinho",
    language: "Idioma",
    login: "Login",
    account: "Conta",

    // ✅ SHOP
    shop_title: "Catálogo",
    shop_subtitle: "As fotos mostram o modelo base do produto e um exemplo de gravação (arte) para você ter uma ideia do resultado final. Se você gostar da gravação da amostra, pode comprar exatamente como está. Se quiser algo personalizado (nome, frase, desenho, medidas ou detalhes específicos), é só escrever seu pedido no campo de Personalização antes de adicionar ao carrinho. Depois de finalizar o pedido, você pode acompanhar tudo e tirar dúvidas pelo chat do pedido..",
    shop_loading: "Carregando…",
    shop_empty: "Nenhum produto ativo ainda.",
    shop_price: "Preço",
    shop_customization_label: "Personalização (opcional)",
    shop_customization_placeholder: "Ex: Nome, texto",
    shop_add_to_cart: "Adicionar ao carrinho",
    shop_added_to_cart: "Adicionado ao carrinho ✅",
    shop_no_photo: "Sem foto",
    shop_has_order_title: "Já tem um pedido?",
    shop_has_order_text: "Acesse o chat com Telefone.",
    shop_go_to_chat: "Ir para o Chat do Pedido",

    // ✅ CUSTOMER CHAT
    cust_chat_title: "Chat do Pedido",
    cust_chat_subtitle: "Se você já usou este aparelho, entra automático.",
    cust_phone: "Telefone",
    cust_pin: "PIN (4 dígitos)",
    cust_phone_placeholder: "ex: 09012345678",
    cust_pin_placeholder: "ex: 1234",
    cust_enter: "Entrar",
    cust_entering: "Entrando…",
    cust_or: "ou",
    cust_google: "Entrar com Google",
    cust_connecting: "Conectando…",
    cust_tip: "Trocar de aparelho/navegador? Faça login com Telefone + PIN ou Google.",
    cust_logout: "Sair",
    cust_messages: "Mensagens",
    cust_order: "Pedido",
    cust_items: "Itens do pedido",
    cust_created_at: "Criado em",
    cust_send: "Enviar",
    cust_write: "Escreva…",
    cust_no_messages: "Sem mensagens ainda.",
    cust_pick_photo: "Foto",
    cust_remove_photo: "Remover foto",
    cust_photo_preview: "Prévia da foto",
    cust_login_error: "Digite Telefone e PIN de 4 dígitos.",

    // status labels
    status_paid: "Pago",
    status_delivered: "Entregue",
    status_cancelled: "Cancelado",
    status_confirmed: "Confirmado",
    status_pending: "Pendente",

    // status hints
    hint_paid: "Pedido confirmado e pago ✅",
    hint_delivered: "Pedido entregue ✅",
    hint_cancelled: "Pedido cancelado",
    hint_confirmed: "Pedido confirmado ✅",
    hint_pending: "Aguardando pagamento/andamento",

    // item customization label
    item_custom: "Personalização",

    // ✅ CART
    cart_loading: "Carregando carrinho…",
    cart_empty: "Carrinho vazio.",
    no_photo: "Sem foto",
    customization: "Personalização",
    per_unit: "/ un",
    quantity: "Quantidade",
    remove: "Remover",
    total: "Total",
    checkout: "Finalizar pedido",

    // ✅ Language Modal
    in_use: "Em uso",
    select: "Selecionar",
    choose_language: "Escolha o idioma",
    close: "Fechar",

    // ✅ CHECKOUT (faltava no seu dict)
    checkout_title: "Finalizar pedido",
    checkout_summary_title: "Resumo do carrinho",
    checkout_cart_loading: "Carregando…",
    checkout_cart_empty: "Seu carrinho está vazio.",
    checkout_customization_label: "Personalização:",
    checkout_google_title: "Conectar Google (opcional)",
    checkout_google_desc:
      "Ajuda a entrar pelo Google em outro aparelho depois. Mas o acesso principal continua sendo Telefone + PIN.",
    checkout_google_connected: "Conectado ✅",
    checkout_google_connecting: "Conectando…",
    checkout_google_button: "Entrar com Google",
    checkout_name: "Nome",
    checkout_phone: "Telefone",
    checkout_pin: "PIN (4 dígitos) — para acessar o chat depois",
    checkout_create_button: "Criar pedido e entrar no chat",
    checkout_creating: "Criando…",
    checkout_tip:
      "Dica: este aparelho ficará logado automaticamente. Trocar de aparelho? Use Telefone + PIN ou Google.",
    checkout_alert_empty: "Carrinho vazio.",
    checkout_alert_fill: "Preencha nome, telefone e PIN de 4 dígitos.",
    checkout_alert_phone_invalid: "Digite um telefone válido.",
    checkout_alert_create_error: "Erro ao criar pedido",

    theme: "Tema",
    choose_theme: "Escolha o tema",
    theme_light: "Claro (oficial)",
    theme_dark: "Escuro (opcional)",

    cust_login_title: "Login do Cliente",
    cust_login_subtitle:
      "Entre com Google e complete seus dados para acessar chat e histórico.",
    cust_login_google: "Entrar com Google",
    cust_login_mobile_tip: "No celular usamos redirect (mais confiável).",
    cust_logged_as: "Logado como:",
    cust_logout_btn: "Sair",
    cust_profile_name: "Nome",
    cust_profile_surname: "Sobrenome",
    cust_profile_phone: "Telefone",
    cust_profile_address: "Endereço (para entrega)",
    cust_profile_save_enter: "Salvar e entrar no Chat",
    cust_profile_history: "Ver histórico",
    cust_profile_next:
      "Próximo: histórico de compras + chats por pedido (orders/{id}/messages).",
    cust_profile_fill_required: "Preencha nome, sobrenome, telefone e endereço.",
    cust_google_fail: "Falha no login Google",
    cust_save_fail: "Falha ao salvar perfil",
    cust_connecting_ellipsis: "Conectando...",
    cust_saving_ellipsis: "Salvando...",


    cust_home_title: "Área do Cliente",
cust_home_subtitle: "Veja seus dados, pedidos e acesse o chat de cada compra.",
cust_home_shop: "Loja",
cust_home_logout: "Sair",
cust_home_guest: "Cliente",
cust_home_welcome: "Bem-vindo(a)",
cust_home_auth_mode: "Modo",
cust_home_auth_phone: "Telefone + PIN",
cust_home_view_orders: "Ver pedidos",
cust_home_open_history: "Abrir histórico",
cust_home_stat_orders: "Pedidos",
cust_home_stat_spent: "Total gasto",
cust_home_stat_last: "Último pedido",
cust_home_recent_title: "Pedidos recentes",
cust_home_recent_subtitle: "Clique para abrir o chat do pedido.",
cust_home_refresh: "Atualizar",
cust_home_empty_title: "Você ainda não tem pedidos.",
cust_home_empty_text: "Quando finalizar uma compra, ela vai aparecer aqui com o chat.",
cust_home_order: "Pedido",
cust_home_created: "Criado em",
cust_home_open_chat: "Abrir chat",
cust_home_view_more: "Ver mais pedidos",
cust_home_error_title: "Não foi possível carregar seus dados",
cust_home_retry: "Tentar novamente",
cust_home_go_login: "Ir para login",


  },

  en: {
    chat: "Chat",
    cart: "Cart",
    language: "Language",
    login: "Login",
    account: "Account",

    // ✅ SHOP
    shop_title: "Catalog",
    shop_subtitle: "The product photos show the base model and a sample engraving (art) so you can see how it looks. If you like the sample engraving, you can buy it exactly as shown. If you want something personalized (name, phrase, design, size, or specific details), just write your request in the Customization field before adding the item to your cart. After you place your order, you can follow everything and ask questions through the order chat.",
    shop_loading: "Loading…",
    shop_empty: "No active products yet.",
    shop_price: "Price",
    shop_customization_label: "Customization (optional)",
    shop_customization_placeholder: "e.g. Name, text",
    shop_add_to_cart: "Add to cart",
    shop_added_to_cart: "Added to cart ✅",
    shop_no_photo: "No photo",
    shop_has_order_title: "Already have an order?",
    shop_has_order_text: "Access the order chat with your phone number.",
    shop_go_to_chat: "Go to Order Chat",

    // ✅ CUSTOMER CHAT
    cust_chat_title: "Order Chat",
    cust_chat_subtitle: "If you’ve used this device before, you’ll be logged in automatically.",
    cust_phone: "Phone",
    cust_pin: "PIN (4 digits)",
    cust_phone_placeholder: "e.g. 09012345678",
    cust_pin_placeholder: "e.g. 1234",
    cust_enter: "Enter",
    cust_entering: "Entering…",
    cust_or: "or",
    cust_google: "Sign in with Google",
    cust_connecting: "Connecting…",
    cust_tip: "New device/browser? Sign in with Phone + PIN or Google.",
    cust_logout: "Logout",
    cust_messages: "Messages",
    cust_order: "Order",
    cust_items: "Order items",
    cust_created_at: "Created at",
    cust_send: "Send",
    cust_write: "Write…",
    cust_no_messages: "No messages yet.",
    cust_pick_photo: "Photo",
    cust_remove_photo: "Remove photo",
    cust_photo_preview: "Photo preview",
    cust_login_error: "Enter Phone and a 4-digit PIN.",

    // status labels
    status_paid: "Paid",
    status_delivered: "Delivered",
    status_cancelled: "Cancelled",
    status_confirmed: "Confirmed",
    status_pending: "Pending",

    // status hints
    hint_paid: "Order confirmed and paid ✅",
    hint_delivered: "Order delivered ✅",
    hint_cancelled: "Order cancelled",
    hint_confirmed: "Order confirmed ✅",
    hint_pending: "Waiting for payment/progress",

    // item customization label
    item_custom: "Customization",

    // ✅ CART
    cart_loading: "Loading cart…",
    cart_empty: "Your cart is empty.",
    no_photo: "No photo",
    customization: "Customization",
    per_unit: "/ unit",
    quantity: "Quantity",
    remove: "Remove",
    total: "Total",
    checkout: "Checkout",

    // ✅ Language Modal
    in_use: "In use",
    select: "Select",
    choose_language: "Choose language",
    close: "Close",

    // ✅ CHECKOUT
    checkout_title: "Checkout",
    checkout_summary_title: "Cart summary",
    checkout_cart_loading: "Loading…",
    checkout_cart_empty: "Your cart is empty.",
    checkout_customization_label: "Customization:",
    checkout_google_title: "Connect Google (optional)",
    checkout_google_desc:
      "Helps you sign in with Google on another device later. Main access is still Phone + PIN.",
    checkout_google_connected: "Connected ✅",
    checkout_google_connecting: "Connecting…",
    checkout_google_button: "Sign in with Google",
    checkout_name: "Name",
    checkout_phone: "Phone",
    checkout_pin: "PIN (4 digits) — to access chat later",
    checkout_create_button: "Create order and open chat",
    checkout_creating: "Creating…",
    checkout_tip:
      "Tip: this device will stay logged in automatically. Changing device? Use Phone + PIN or Google.",
    checkout_alert_empty: "Cart is empty.",
    checkout_alert_fill: "Please fill name, phone and a 4-digit PIN.",
    checkout_alert_phone_invalid: "Please enter a valid phone number.",
    checkout_alert_create_error: "Failed to create order",

    theme: "Theme",
    choose_theme: "Choose theme",
    theme_light: "Light (official)",
    theme_dark: "Dark (optional)",

    cust_login_title: "Customer Login",
    cust_login_subtitle:
      "Sign in with Google and complete your details to access chat and order history.",
    cust_login_google: "Sign in with Google",
    cust_login_mobile_tip: "On mobile we use redirect (more reliable).",
    cust_logged_as: "Signed in as:",
    cust_logout_btn: "Logout",
    cust_profile_name: "First name",
    cust_profile_surname: "Last name",
    cust_profile_phone: "Phone",
    cust_profile_address: "Address (for delivery)",
    cust_profile_save_enter: "Save and open Chat",
    cust_profile_history: "View history",
    cust_profile_next:
      "Next: order history + per-order chats (orders/{id}/messages).",
    cust_profile_fill_required: "Please fill name, surname, phone, and address.",
    cust_google_fail: "Google login failed",
    cust_save_fail: "Failed to save profile",
    cust_connecting_ellipsis: "Connecting...",
    cust_saving_ellipsis: "Saving...",

    cust_home_title: "Customer Area",
cust_home_subtitle: "See your details, orders, and open the chat for each purchase.",
cust_home_shop: "Shop",
cust_home_logout: "Logout",
cust_home_guest: "Customer",
cust_home_welcome: "Welcome",
cust_home_auth_mode: "Mode",
cust_home_auth_phone: "Phone + PIN",
cust_home_view_orders: "View orders",
cust_home_open_history: "Open history",
cust_home_stat_orders: "Orders",
cust_home_stat_spent: "Total spent",
cust_home_stat_last: "Last order",
cust_home_recent_title: "Recent orders",
cust_home_recent_subtitle: "Tap to open the order chat.",
cust_home_refresh: "Refresh",
cust_home_empty_title: "You don't have any orders yet.",
cust_home_empty_text: "After checkout, your order will show up here with the chat.",
cust_home_order: "Order",
cust_home_created: "Created at",
cust_home_open_chat: "Open chat",
cust_home_view_more: "View more orders",
cust_home_error_title: "We couldn't load your data",
cust_home_retry: "Try again",
cust_home_go_login: "Go to login",



  },

  ja: {
    chat: "チャット",
    cart: "カート",
    language: "言語",
    login: "ログイン",
    account: "アカウント",

    // ✅ SHOP
    shop_title: "カタログ",
    shop_subtitle: "商品写真には、ベースとなるモデルと「刻印（デザイン）」のサンプル例が表示されています。サンプルの刻印が気に入った場合は、そのままのデザインで購入できます。より細かくカスタマイズしたい場合（名前・文字・デザイン・サイズ・指定事項など）は、カートに入れる前に カスタマイズ欄 に希望内容をご記入ください。注文後は 注文チャット で確認や相談ができます",
    shop_loading: "読み込み中…",
    shop_empty: "現在、販売中の商品はありません。",
    shop_price: "価格",
    shop_customization_label: "カスタマイズ（任意）",
    shop_customization_placeholder: "例：名前、文字",
    shop_add_to_cart: "カートに追加",
    shop_added_to_cart: "カートに追加しました ✅",
    shop_no_photo: "画像なし",
    shop_has_order_title: "すでに注文がありますか？",
    shop_has_order_text: "電話番号で注文チャットにアクセスできます。",
    shop_go_to_chat: "注文チャットへ",

    // ✅ CUSTOMER CHAT
    cust_chat_title: "注文チャット",
    cust_chat_subtitle: "この端末を以前使ったことがあれば自動ログインします。",
    cust_phone: "電話番号",
    cust_pin: "PIN（4桁）",
    cust_phone_placeholder: "例：09012345678",
    cust_pin_placeholder: "例：1234",
    cust_enter: "ログイン",
    cust_entering: "ログイン中…",
    cust_or: "または",
    cust_google: "Googleでログイン",
    cust_connecting: "接続中…",
    cust_tip: "別端末/別ブラウザですか？電話番号+PIN または Googleでログインしてください。",
    cust_logout: "ログアウト",
    cust_messages: "メッセージ",
    cust_order: "注文",
    cust_items: "注文内容",
    cust_created_at: "作成日時",
    cust_send: "送信",
    cust_write: "入力…",
    cust_no_messages: "まだメッセージはありません。",
    cust_pick_photo: "写真",
    cust_remove_photo: "写真を削除",
    cust_photo_preview: "写真プレビュー",
    cust_login_error: "電話番号と4桁のPINを入力してください。",

    // status labels
    status_paid: "支払い済み",
    status_delivered: "配達完了",
    status_cancelled: "キャンセル",
    status_confirmed: "確認済み",
    status_pending: "保留",

    // status hints
    hint_paid: "支払い確認済み ✅",
    hint_delivered: "配達完了 ✅",
    hint_cancelled: "キャンセルされました",
    hint_confirmed: "注文確認済み ✅",
    hint_pending: "支払い/進行待ち",

    // item customization label
    item_custom: "カスタム",

    // ✅ CART
    cart_loading: "カートを読み込み中…",
    cart_empty: "カートは空です。",
    no_photo: "写真なし",
    customization: "カスタマイズ",
    per_unit: "/ 個",
    quantity: "数量",
    remove: "削除",
    total: "合計",
    checkout: "注文を確定する",

    // ✅ Language Modal
    in_use: "使用中",
    select: "選択する",
    choose_language: "言語を選択",
    close: "閉じる",

    // ✅ CHECKOUT
    checkout_title: "注文を確定",
    checkout_summary_title: "カート内容",
    checkout_cart_loading: "読み込み中…",
    checkout_cart_empty: "カートは空です。",
    checkout_customization_label: "カスタマイズ：",
    checkout_google_title: "Google連携（任意）",
    checkout_google_desc:
      "別の端末でGoogleログインしやすくなります。メインのログインは「電話番号 + PIN」です。",
    checkout_google_connected: "接続済み ✅",
    checkout_google_connecting: "接続中…",
    checkout_google_button: "Googleでログイン",
    checkout_name: "名前",
    checkout_phone: "電話番号",
    checkout_pin: "PIN（4桁）— 後でチャットに入るため",
    checkout_create_button: "注文を作成してチャットへ",
    checkout_creating: "作成中…",
    checkout_tip:
      "ヒント：この端末は自動でログイン状態になります。別端末の場合は「電話番号 + PIN」またはGoogleを使ってください。",
    checkout_alert_empty: "カートは空です。",
    checkout_alert_fill: "名前・電話番号・4桁のPINを入力してください。",
    checkout_alert_phone_invalid: "正しい電話番号を入力してください。",
    checkout_alert_create_error: "注文作成に失敗しました",

    theme: "テーマ",
    choose_theme: "テーマを選択",
    theme_light: "ライト（公式）",
    theme_dark: "ダーク（任意）",

    cust_login_title: "お客様ログイン",
    cust_login_subtitle:
      "Googleでログインして、チャットと購入履歴にアクセスするための情報を入力してください。",
    cust_login_google: "Googleでログイン",
    cust_login_mobile_tip: "スマホではredirect（より安定）を使います。",
    cust_logged_as: "ログイン中：",
    cust_logout_btn: "ログアウト",
    cust_profile_name: "名前",
    cust_profile_surname: "姓",
    cust_profile_phone: "電話番号",
    cust_profile_address: "住所（配達用）",
    cust_profile_save_enter: "保存してチャットへ",
    cust_profile_history: "購入履歴を見る",
    cust_profile_next:
      "次：購入履歴 + 注文ごとのチャット（orders/{id}/messages）。",
    cust_profile_fill_required: "名前・姓・電話番号・住所を入力してください。",
    cust_google_fail: "Googleログインに失敗しました",
    cust_save_fail: "プロフィールの保存に失敗しました",
    cust_connecting_ellipsis: "接続中...",
    cust_saving_ellipsis: "保存中...",

    cust_home_title: "マイページ",
cust_home_subtitle: "お客様情報・注文履歴・各注文のチャットにアクセスできます。",
cust_home_shop: "ショップ",
cust_home_logout: "ログアウト",
cust_home_guest: "お客様",
cust_home_welcome: "ようこそ",
cust_home_auth_mode: "ログイン方法",
cust_home_auth_phone: "電話番号 + PIN",
cust_home_view_orders: "注文履歴を見る",
cust_home_open_history: "履歴を開く",
cust_home_stat_orders: "注文数",
cust_home_stat_spent: "合計金額",
cust_home_stat_last: "最新注文",
cust_home_recent_title: "最近の注文",
cust_home_recent_subtitle: "注文チャットを開けます。",
cust_home_refresh: "更新",
cust_home_empty_title: "注文はまだありません。",
cust_home_empty_text: "注文完了後、ここに表示され、チャットも使えます。",
cust_home_order: "注文",
cust_home_created: "作成日時",
cust_home_open_chat: "チャットを開く",
cust_home_view_more: "もっと見る",
cust_home_error_title: "データを読み込めませんでした",
cust_home_retry: "再試行",
cust_home_go_login: "ログインへ",



  },
} satisfies Record<Lang, Record<string, string>>;

export type I18nKey = keyof (typeof dict)["pt"];

export function t(key: I18nKey, lang?: Lang) {
  const l = lang || (typeof window === "undefined" ? "pt" : getLang());
  return dict[l][key] || dict.pt[key] || String(key);
}
