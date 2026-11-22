import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowDown, ArrowLeft, ArrowRight, BadgeCheck, BookOpen, Camera, Check, ChevronDown, ChevronRight,
  CircleHelp, Clock3, Facebook, Headphones, Heart, HeartHandshake, Instagram, Laptop, Leaf, LockKeyhole, Mail,
  MapPin, Menu, Minus, PackageCheck, Pencil, Phone, Plus, Search, ShieldCheck,
  Pause, Play, ShoppingBag, ShoppingCart, Smartphone, Sparkles, Star, Tablet, Trash2, Truck, Upload,
  UserRound, Watch, X, LogOut, LayoutDashboard, ExternalLink, MessageCircle,
} from "lucide-react";
import api, { errorMessage } from "./api";

const StoreContext = createContext(null);
const useStore = () => useContext(StoreContext);
const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const imageFallback = "/images/banners/book-fallback.jpg";
const productImageFallback = "/images/products/apple-iphone-13.jpg";
const conditionText = { like_new: "Like New", good: "Good", average: "Average" };
const localProductImage = (product = {}) => {
  const image = typeof product === "string" ? "" : product.image;
  if (image?.startsWith("/images/")) return image;
  if (image?.startsWith("/media/")) {
    const apiOrigin = new URL(api.defaults.baseURL, window.location.origin).origin;
    return new URL(image, apiOrigin).href;
  }
  if (image?.startsWith("http://") || image?.startsWith("https://")) return image;
  const name = typeof product === "string" ? product : product.slug || product.product_slug || product.product_name || product.name || "";
  const slug = name.toLowerCase().replace(/&/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug ? `/images/products/${slug}.jpg` : imageFallback;
};
const localCategoryImage = (category) => category?.image?.startsWith("/images/") ? category.image : imageFallback;
const productCategoryLinks = [
  ["Mobiles", "mobiles"],
  ["Laptops", "laptops"],
  ["Books", "books"],
  ["Tablets", "tablets"],
  ["Smart Watches", "smart-watches"],
  ["Headphones & Earbuds", "headphones-earbuds"],
  ["Cameras", "cameras"],
];

function App() {
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState([]);
  const [wish, setWish] = useState([]);
  const [toast, setToast] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const notify = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }, []);

  const refreshCounts = useCallback(async () => {
    if (!localStorage.getItem("renewkart_token")) {
      setCart([]);
      setWish([]);
      return;
    }
    try {
      const [cartResponse, wishResponse] = await Promise.all([api.get("/cart/"), api.get("/wishlist/")]);
      setCart(cartResponse.data);
      setWish(wishResponse.data);
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.removeItem("renewkart_token");
        setUser(null);
        setCart([]);
        setWish([]);
        notify("Your session expired. Please sign in again.");
      } else {
        notify(errorMessage(error));
      }
    }
  }, [notify]);

  useEffect(() => {
    if (!localStorage.getItem("renewkart_token")) return;
    api.get("/profile/").then(({ data }) => setUser(data)).catch((error) => {
      localStorage.removeItem("renewkart_token");
      setUser(null);
      setCart([]);
      setWish([]);
      notify(errorMessage(error));
    });
    refreshCounts();
  }, [refreshCounts, notify]);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return undefined;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll("main > section, main > div, footer").forEach((element) => {
      element.classList.add("scroll-reveal");
      observer.observe(element);
    });
    return () => observer.disconnect();
  }, [location.pathname]);

  const signIn = useCallback(async (path, values) => {
    const { data } = await api.post(path, values);
    localStorage.setItem("renewkart_token", data.token);
    setUser(data.user);
    await refreshCounts();
    return data.user;
  }, [refreshCounts]);

  const signOut = async () => {
    let remoteSignOut = true;
    try { await api.post("/auth/logout/"); } catch { remoteSignOut = false; }
    localStorage.removeItem("renewkart_token");
    setUser(null);
    setCart([]);
    setWish([]);
    notify(remoteSignOut ? "You have been signed out." : "Signed out on this device. The server could not be reached to revoke your token.");
    navigate("/");
  };

  const addCart = async (product, quantity = 1) => {
    if (!user) { notify("Sign in to add items to your cart."); navigate("/login"); return; }
    try {
      await api.post("/cart/", { product_id: product.id, quantity });
      await refreshCounts();
      notify("Added to your cart.");
    } catch (error) { notify(errorMessage(error)); }
  };

  const toggleWish = async (product) => {
    if (!user) { notify("Sign in to save items to your wishlist."); navigate("/login"); return; }
    const found = wish.find((item) => item.product.id === product.id);
    try {
      if (found) await api.delete(`/wishlist/?item_id=${found.id}`);
      else await api.post("/wishlist/", { product_id: product.id });
      await refreshCounts();
      notify(found ? "Removed from wishlist." : "Saved to wishlist.");
    } catch (error) { notify(errorMessage(error)); }
  };

  const value = useMemo(() => ({
    user, cart, wish, signIn, signOut, refreshCounts, addCart, toggleWish, notify, setUser,
  }), [user, cart, wish, signIn, refreshCounts, notify]);

  return (
    <StoreContext.Provider value={value}>
      <div className="min-h-screen">
        <Announcement />
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:slug" element={<ProductPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:orderNumber" element={<OrderDetail />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/exchange" element={<Exchange />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/warranty" element={<Warranty />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:uid/:token" element={<ResetPassword />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Footer />
        {location.pathname === "/" && <button type="button" className="whatsapp-float" onClick={() => setChatOpen(true)} aria-label="Open ReNewKart chat"><MessageCircle size={23} /><span>Chat with us</span></button>}
        {chatOpen && <ChatBot onClose={() => setChatOpen(false)} />}
        {toast && <div role="status" className="fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 rounded-full bg-[#1f3328] px-5 py-3 text-sm font-semibold text-white shadow-xl">{toast}</div>}
      </div>
    </StoreContext.Provider>
  );
}

function Announcement() {
  return <div className="announcement-bar" aria-label="Old things, new life — A second life, well spent"><div className="announcement-track"><span>Old things, new life <i>·</i> A second life, well spent</span><span aria-hidden="true">Old things, new life <i>·</i> A second life, well spent</span></div></div>;
}

function Header() {
  const { user, cart, wish } = useStore();
  const [open, setOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const submit = (event) => {
    event.preventDefault();
    navigate(`/shop?search=${encodeURIComponent(search)}`);
    setOpen(false);
  };
  return (
    <header className="sticky top-0 z-50 border-b border-[#e7ebe4] bg-[#f7f8f5]/95 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-3 sm:px-7 lg:px-10">
        <button className="rounded-xl p-2 text-[#24392b] md:hidden" aria-label="Open menu" onClick={() => setOpen(!open)}>{open ? <X size={21} /> : <Menu size={21} />}</button>
        <Logo />
        <nav className="hidden items-center gap-6 pl-3 text-[13px] font-semibold text-[#506054] lg:flex">
          <Link className="hover:text-[#578147]" to="/">Home</Link>
          <Link className="hover:text-[#578147]" to="/shop">Shop</Link>
          <div className="relative" onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setCategoriesOpen(false);
          }}>
            <button type="button" aria-expanded={categoriesOpen} aria-haspopup="true" onClick={() => setCategoriesOpen((visible) => !visible)} className="flex items-center gap-1 hover:text-[#578147]">Categories <ChevronDown size={14} /></button>
            <div className={`${categoriesOpen ? "visible opacity-100" : "invisible opacity-0"} absolute left-0 top-full z-30 mt-3 w-48 rounded-2xl border border-[#e8ede5] bg-white p-2 shadow-xl transition`}>
              <Link to="/shop" onClick={() => setCategoriesOpen(false)} className="block rounded-xl px-3 py-2 text-sm font-bold text-[#55794d] hover:bg-[#f1f6ed]">Browse all</Link>
              {productCategoryLinks.map(([label, slug]) => <Link key={slug} to={`/shop?category=${slug}`} onClick={() => setCategoriesOpen(false)} className="block rounded-xl px-3 py-2 text-sm hover:bg-[#f1f6ed]">{label}</Link>)}
              <Link to="/exchange" onClick={() => setCategoriesOpen(false)} className="block rounded-xl px-3 py-2 text-sm hover:bg-[#f1f6ed]">Exchange Zone</Link>
            </div>
          </div>
          <Link className="hover:text-[#578147]" to="/about">Our story</Link>
          <Link className="rounded-full bg-[#e6efdf] px-3 py-1.5 text-[#3d6c42] hover:bg-[#d9e8d0]" to="/exchange">Exchange zone</Link>
        </nav>
        <form onSubmit={submit} className="header-search ml-auto hidden h-10 max-w-[270px] flex-1 items-center gap-2 rounded-full border border-[#e2e8de] bg-white px-4 lg:flex">
          <Search size={16} className="shrink-0 text-[#87958a]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search mobiles, books..." className="w-full bg-transparent text-xs outline-none placeholder:text-[#97a198]" aria-label="Search products" />
          <button className="sr-only">Search</button>
        </form>
        <div className="ml-auto flex items-center gap-1.5 lg:ml-0 lg:gap-2">
          <Link to="/wishlist" className="header-action relative grid size-10 place-items-center rounded-full text-[#45574b] hover:bg-[#edf2e9]" aria-label="Wishlist"><Heart size={19} />{wish.length > 0 && <span className="header-count absolute right-0 top-0 grid size-[17px] place-items-center rounded-full bg-[#679353] text-[10px] font-bold text-white">{wish.length}</span>}</Link>
          <Link to="/cart" className="header-action relative grid size-10 place-items-center rounded-full text-[#45574b] hover:bg-[#edf2e9]" aria-label="Cart"><ShoppingCart size={19} />{cart.length > 0 && <span className="header-count absolute right-0 top-0 grid size-[17px] place-items-center rounded-full bg-[#679353] text-[10px] font-bold text-white">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>}</Link>
          {user ? <Link to={user.is_staff ? "/admin" : "/profile"} className="hidden h-10 items-center gap-2 rounded-full bg-[#e5efdf] px-3 text-xs font-bold text-[#3c6740] sm:flex"><UserRound size={15} />{user.first_name || "Account"}</Link> : <Link to="/login" className="button-primary hidden h-10 items-center rounded-full px-4 text-xs font-bold text-white sm:flex">Sign in</Link>}
        </div>
      </div>
      {open && <div className="border-t border-[#e7ebe4] bg-[#f7f8f5] px-5 py-4 md:hidden">
        <form onSubmit={submit} className="mb-3 flex h-11 items-center gap-2 rounded-xl border border-[#e2e8de] bg-white px-3"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products" className="w-full bg-transparent text-sm outline-none" /></form>
        {[["Home", "/"], ["Shop all", "/shop"], ...productCategoryLinks.map(([label, slug]) => [label, `/shop?category=${slug}`]), ["Exchange zone", "/exchange"], ["About us", "/about"]].map(([label, url]) => <Link key={label} to={url} onClick={() => setOpen(false)} className="block border-b border-[#e9ede6] py-3 text-sm font-medium">{label}</Link>)}
        {user ? <Link to="/profile" onClick={() => setOpen(false)} className="block py-3 text-sm font-medium">My account</Link> : <Link to="/login" onClick={() => setOpen(false)} className="block py-3 text-sm font-medium">Sign in / Sign up</Link>}
      </div>}
    </header>
  );
}

function ChatBot({ onClose }) {
  const [messages, setMessages] = useState([
    { from: "bot", text: "Hello! I am the ReNewKart Assistant. How can I help you? Click a button below." },
  ]);
  const [input, setInput] = useState("");

  const botReply = (message) => {
    const text = message.toLowerCase();
    if (text.includes("price") || text.includes("rate") || text.includes("cost")) {
      return "Product prices are available on the product page. You can browse 5000+ products.";
    }
    if (text.includes("warranty")) {
      return "Every product includes a 6-month warranty. It is checked, cleaned, and ready to use.";
    }
    if (text.includes("delivery")) {
      return "Delivery in Chennai usually takes 2-3 days.";
    }
    if (text.includes("emi") || text.includes("payment") || text.includes("upi")) {
      return "UPI, cards, and EMI options are available for easy payment.";
    }
    if (text.includes("human") || text.includes("call") || text.includes("number")) {
      return "You can talk to us on WhatsApp using the button below.";
    }
    return "I do not understand that yet. Please type Price, Warranty, or Delivery.";
  };

  const sendMessage = (message) => {
    const cleanMessage = message.trim();
    if (!cleanMessage) return;
    setMessages((current) => [
      ...current,
      { from: "user", text: cleanMessage },
      { from: "bot", text: botReply(cleanMessage) },
    ]);
  };

  const submit = (event) => {
    event.preventDefault();
    sendMessage(input);
    setInput("");
  };

  return (
    <aside className="chatbot-popup" role="dialog" aria-label="ReNewKart Assistant">
      <header className="chatbot-header">
        <div>
          <p className="chatbot-title">ReNewKart Assistant</p>
          <p className="chatbot-online"><span />Green Online</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close chat" className="chatbot-close"><X size={18} /></button>
      </header>
      <div className="chatbot-messages">
        {messages.map((message, index) => (
          <div key={`${message.from}-${index}`} className={`chatbot-message ${message.from === "user" ? "chatbot-message-user" : "chatbot-message-bot"}`}>
            {message.text}
          </div>
        ))}
      </div>
      <div className="chatbot-quick">
        <button type="button" onClick={() => sendMessage("Price")}>Price ?</button>
        <button type="button" onClick={() => sendMessage("Warranty")}>Warranty ?</button>
        <button type="button" onClick={() => sendMessage("Delivery")}>Delivery ?</button>
      </div>
      <form onSubmit={submit} className="chatbot-input">
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Type a message..." aria-label="Chat message" />
        <button type="submit" aria-label="Send message"><ArrowRight size={16} /></button>
      </form>
      <a className="chatbot-whatsapp" href="https://wa.me/?text=Hello%20ReNewKart" target="_blank" rel="noreferrer">Talk on WhatsApp</a>
    </aside>
  );
}

function Logo({ footer = false }) {
  return <Link to="/" aria-label="ReNewKart home" className={`brand-lockup${footer ? " brand-lockup-footer" : ""}`}>
    <span className="brand-logo-mark"><img src="/images/logo/logo.png" alt="" /></span>
    <span className="brand-copy">
      <span className="brand-wordmark" data-text="ReNewKart" aria-label="ReNewKart">
        {Array.from("ReNewKart").map((letter, index) => <span key={index} className={`brand-letter ${index < 2 ? "brand-letter-dark" : index < 5 ? "brand-letter-bright" : "brand-letter-black"}`} style={{ "--letter-index": index }} aria-hidden="true">{letter}</span>)}
      </span>
      <span className="brand-tagline">Old things, new life</span>
    </span>
  </Link>;
}

function Footer() {
  return (
    <footer className="mt-20 bg-[#1f3328] text-white">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-12">
        <div>
          <Logo footer />
          <p className="mt-4 max-w-xs text-sm leading-6 text-[#bdc9be]">Good things deserve another go. Shop thoughtfully restored tech and pre-loved reads.</p>
          <p className="mt-4 text-sm font-semibold text-[#d3e6ca]">Old things, new life</p>
          <div className="mt-5 flex gap-3"><a aria-label="Instagram" className="grid size-9 place-items-center rounded-full bg-white/10 hover:bg-white/20" href="https://instagram.com" target="_blank" rel="noreferrer"><Instagram size={16} /></a><a aria-label="Facebook" className="grid size-9 place-items-center rounded-full bg-white/10 hover:bg-white/20" href="https://facebook.com" target="_blank" rel="noreferrer"><Facebook size={16} /></a></div>
        </div>
        <div><p className="mb-4 text-sm font-bold">Explore</p><FooterLink to="/shop">Shop all</FooterLink><FooterLink to="/about">Our story</FooterLink><FooterLink to="/exchange">Sell / exchange</FooterLink><FooterLink to="/orders">Track an order</FooterLink></div>
        <div><p className="mb-4 text-sm font-bold">Help & support</p><FooterLink to="/contact">Contact us</FooterLink><FooterLink to="/faq">FAQs</FooterLink><FooterLink to="/warranty">Warranty & returns</FooterLink><FooterLink to="/profile">My account</FooterLink></div>
        <div><p className="mb-4 text-sm font-bold">Say hello</p><a href="mailto:hello@renewkart.in" className="flex items-center gap-2 text-sm text-[#bdc9be] hover:text-white"><Mail size={15} /> hello@renewkart.in</a><p className="mt-3 text-sm text-[#bdc9be]">Mon–Sat, 9am–6pm IST</p><div className="mt-6 flex items-start gap-2 text-xs leading-5 text-[#9faf9f]"><Leaf size={16} className="mt-0.5 shrink-0 text-[#a2c493]" />Every second life is a little kinder to the planet.</div></div>
      </div>
      <div className="border-t border-white/10 px-5 py-4 text-center text-xs text-[#9faf9f]">© {new Date().getFullYear()} ReNewKart. Better stuff, less waste.</div>
    </footer>
  );
}
function FooterLink({ to, children }) { return <Link className="mb-3 block text-sm text-[#bdc9be] hover:text-white" to={to}>{children}</Link>; }

function SectionHeading({ eyebrow, title, description, action }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
    <div>{eyebrow && <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[.19em] text-[#71905c]">{eyebrow}</p>}<h2 className="font-display text-2xl font-extrabold tracking-[-.8px] text-[#21372a] sm:text-3xl">{title}</h2>{description && <p className="mt-2 max-w-xl text-sm leading-6 text-[#718074]">{description}</p>}</div>
    {action}
  </div>;
}
function PageIntro({ eyebrow, title, text }) {
  return <div className="bg-[#edf3e9] px-5 py-12 sm:px-10 sm:py-16"><div className="mx-auto max-w-[1400px]"><p className="mb-3 text-[11px] font-extrabold uppercase tracking-[.2em] text-[#71905c]">{eyebrow}</p><h1 className="font-display text-4xl font-extrabold tracking-[-1.8px] text-[#203629] sm:text-5xl">{title}</h1>{text && <p className="mt-3 max-w-2xl text-sm leading-6 text-[#667769] sm:text-base">{text}</p>}</div></div>;
}
function ProductCard({ product, compact = false }) {
  const { addCart, toggleWish, wish, user, notify, refreshCounts } = useStore();
  const navigate = useNavigate();
  const saved = wish.some((item) => item.product.id === product.id);
  const buyNow = async () => {
    if (!user) {
      notify("Sign in to continue with your purchase.");
      navigate("/login");
      return;
    }
    try {
      await api.post("/cart/", { product_id: product.id, quantity: 1 });
      await refreshCounts();
      navigate("/checkout");
    } catch (error) {
      notify(errorMessage(error));
    }
  };
  return <article className={`group overflow-hidden rounded-[20px] border border-[#e9ede6] bg-white transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_38px_-22px_rgba(27,52,33,.25)] ${compact ? "" : ""}`}>
    <div className="relative aspect-[1.17/1] overflow-hidden bg-[#eff2ed]">
      <Link to={`/product/${product.slug}`}><img src={localProductImage(product)} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-110" onError={(e) => { e.currentTarget.src = productImageFallback; }} /></Link>
      <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-[#4c654d]">{conditionText[product.condition] || product.condition_label}</span>
      {product.old_price && <span className="absolute bottom-3 left-3 rounded-full bg-[#e4efdc] px-2.5 py-1 text-[10px] font-bold text-[#4e794a]">{Math.round((1 - product.price / product.old_price) * 100)}% less</span>}
      <button onClick={() => toggleWish(product)} aria-label={saved ? "Remove from wishlist" : "Add to wishlist"} className={`absolute right-3 top-3 grid size-9 place-items-center rounded-full shadow-sm transition ${saved ? "bg-[#fff0ef] text-[#d6655e]" : "bg-white/95 text-[#526056] hover:text-[#d6655e]"}`}><Heart size={17} fill={saved ? "currentColor" : "none"} /></button>
    </div>
    <div className="p-3.5 sm:p-4">
      <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#94a094]">{product.brand || product.category_name}</p>
      <Link to={`/product/${product.slug}`} className="mt-1 block min-h-10 font-display text-sm font-bold leading-5 text-[#283b2e] hover:text-[#638c50]">{product.name}</Link>
      <div className="mt-2 flex items-center gap-1.5"><Star size={13} className="fill-[#dfaa48] text-[#dfaa48]" /><span className="text-xs font-bold text-[#4d5e51]">{Number(product.rating || 0).toFixed(1)}</span><span className="text-[10px] text-[#a0a9a0]">({product.ratings_count || 0})</span></div>
      <div className="mt-3"><span className="product-price font-display text-base font-extrabold text-[#23372b]">{money(product.price)}</span>{product.old_price && <span className="ml-1.5 text-[11px] text-[#9ca69c] line-through">{money(product.old_price)}</span>}</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={!product.stock} onClick={() => addCart(product)} aria-label={`Add ${product.name} to cart`} className="button-primary add-to-cart-button min-h-9 rounded-full px-1.5 text-[9px] font-bold leading-tight text-white disabled:cursor-not-allowed disabled:opacity-50 sm:px-2 sm:text-[10px]">ADD TO CART</button>
        <button type="button" disabled={!product.stock} onClick={buyNow} className="min-h-9 rounded-full border border-[#dfe7dd] bg-white px-1.5 text-[9px] font-bold leading-tight text-[#456348] hover:bg-[#f1f6ed] disabled:cursor-not-allowed disabled:opacity-50 sm:px-2 sm:text-[10px]">BUY NOW</button>
      </div>
      {product.stock < 5 && <p className="mt-2 text-[10px] font-semibold text-[#b26d37]">{product.stock === 0 ? "Out of stock" : `Only ${product.stock} left`}</p>}
    </div>
  </article>;
}
function ProductGrid({ products, loading, empty = "No products found." }) {
  if (loading) return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="animate-pulse rounded-[20px] bg-white p-3"><div className="aspect-square rounded-xl bg-[#e9eee7]" /><div className="mt-4 h-3 w-2/3 rounded bg-[#e9eee7]" /><div className="mt-3 h-4 rounded bg-[#e9eee7]" /></div>)}</div>;
  if (!products?.length) return <div className="rounded-3xl border border-dashed border-[#d7e0d4] bg-white py-16 text-center text-sm text-[#758276]">{empty}<p className="mt-2">Try another search or explore all categories.</p></div>;
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">{products.map((p) => <ProductCard key={p.id} product={p} />)}</div>;
}

const sellStorySteps = [
  { title: "Pack Your Old Things", short: "Pack it up", copy: "Put your old phone and laptop in a ReNewKart box." },
  { title: "We Pick Up FREE From Your Home", short: "Free pickup", copy: "Our friendly delivery partner collects it right from your door." },
  { title: "We Check & Clean", short: "We check it", copy: "Our team carefully checks and cleans every device." },
  { title: "You Get CASH Instantly!", short: "Get paid", copy: "Your offer is ready. Get cash straight away!" },
];

function SellStoryVisual({ step, playing, onToggle }) {
  const details = sellStorySteps[step];
  return <div className={`sell-story-stage sell-story-scene-${step + 1}`} role="group" aria-label={`Scene ${step + 1}: ${details.title}`}>
    <span className="sell-story-float sell-story-float-cash" aria-hidden="true">💸</span>
    <span className="sell-story-float sell-story-float-box" aria-hidden="true">📦</span>
    <div key={step} className="sell-story-art" aria-hidden="true">
      {step === 0 && <div className="sell-story-packing">
        <div className="sell-story-device sell-story-phone"><Smartphone size={30} /></div>
        <div className="sell-story-device sell-story-laptop"><Laptop size={34} /></div>
        <span className="sell-story-hand sell-story-hand-left">🙌</span>
        <span className="sell-story-hand sell-story-hand-right">🙌</span>
        <div className="sell-story-box"><PackageCheck size={27} /><span>ReNewKart</span></div>
      </div>}
      {step === 1 && <div className="sell-story-pickup">
        <div className="sell-story-door"><span /></div>
        <div className="sell-story-delivery-person"><span className="sell-story-smile">☺</span><Truck size={58} /></div>
        <span className="sell-story-pickup-tag">FREE PICKUP</span>
      </div>}
      {step === 2 && <div className="sell-story-check">
        <div className="sell-story-check-phone"><Smartphone size={50} /><span><Check size={19} /></span></div>
        <div className="sell-story-check-list"><span><Check size={15} /> Checked</span><span><Check size={15} /> Cleaned</span><span><Check size={15} /> Ready</span></div>
      </div>}
      {step === 3 && <div className="sell-story-payment">
        <div className="sell-story-confetti">{Array.from({ length: 8 }, (_, index) => <i key={index} style={{ animationDelay: `${index * 100}ms` }} />)}</div>
        <span className="sell-story-cash-note">₹ ₹ ₹</span>
        <div className="sell-story-payment-alert"><span>✓</span><strong>₹5,000 Received!</strong></div>
        <span className="sell-story-cash-hands">🤲</span>
      </div>}
    </div>
    <div className="sell-story-caption" aria-live="off">
      <span className="sell-story-step-label">STEP 0{step + 1} <span>·</span> 04</span>
      <h3>{details.title}</h3>
      <p>{details.copy}</p>
    </div>
    <div className="sell-story-controls">
      <span className="sell-story-muted">AUTOPLAY <span>·</span> LOOP <span>·</span> MUTED</span>
      <button type="button" onClick={onToggle} className="sell-story-play" aria-label={playing ? "Pause story" : "Play story"} title={playing ? "Pause story" : "Play story"}>
        {playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
      </button>
    </div>
  </div>;
}

function PriceRangeFilter({ min, max, onApply, onClear }) {
  const [minDraft, setMinDraft] = useState(min);
  const [maxDraft, setMaxDraft] = useState(max);
  const [error, setError] = useState("");
  useEffect(() => {
    setMinDraft(min);
    setMaxDraft(max);
    setError("");
  }, [min, max]);
  const submit = (event) => {
    event.preventDefault();
    const minValue = minDraft.trim();
    const maxValue = maxDraft.trim();
    if ([minValue, maxValue].some((value) => value && (!Number.isFinite(Number(value)) || Number(value) < 0))) {
      setError("Enter valid non-negative prices.");
      return;
    }
    if (minValue && maxValue && Number(minValue) > Number(maxValue)) {
      setError("Minimum price must not exceed maximum price.");
      return;
    }
    setError("");
    onApply(minValue, maxValue);
  };
  return <form onSubmit={submit} className="rounded-2xl border border-[#e7ebe4] bg-white p-4 sm:p-5">
    <div className="flex items-start justify-between gap-2">
      <div><h2 className="font-display text-sm font-extrabold text-[#304334]">Price Filter</h2><p className="mt-1 text-[11px] text-[#879387]">Choose your price range</p></div>
      <button type="button" onClick={() => { setMinDraft(""); setMaxDraft(""); setError(""); onClear(); }} className="shrink-0 text-[11px] font-bold text-[#5b8051] underline-offset-2 hover:underline">Clear Filter</button>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className="text-[11px] font-semibold text-[#667769]">Min Price
        <input type="number" min="0" step="1" value={minDraft} onChange={(event) => setMinDraft(event.target.value)} placeholder="e.g. 5000" className="mt-1 h-10 w-full rounded-xl border border-[#e8ede6] px-3 text-sm outline-none focus:border-[#9dbb91]" />
      </label>
      <label className="text-[11px] font-semibold text-[#667769]">Max Price
        <input type="number" min="0" step="1" value={maxDraft} onChange={(event) => setMaxDraft(event.target.value)} placeholder="e.g. 20000" className="mt-1 h-10 w-full rounded-xl border border-[#e8ede6] px-3 text-sm outline-none focus:border-[#9dbb91]" />
      </label>
      <button type="submit" className="button-primary h-10 rounded-xl px-5 text-sm font-bold uppercase text-white">Filter</button>
    </div>
    {error && <p role="alert" className="mt-2 text-xs font-semibold text-[#b4463e]">{error}</p>}
  </form>;
}

function AnimatedCount({ value }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (value === null || value === undefined) return undefined;
    let step = 0;
    const timer = window.setInterval(() => {
      step += 1;
      setCount(Math.round(value * step / 30));
      if (step === 30) window.clearInterval(timer);
    }, 36);
    return () => window.clearInterval(timer);
  }, [value]);
  return <>{value === null || value === undefined ? "—" : `${count.toLocaleString("en-IN")}+`}</>;
}

function Home() {
  const { notify } = useStore();
  const [products, setProducts] = useState([]);
  const [productCount, setProductCount] = useState(null);
  const [categories, setCategories] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sellStoryStep, setSellStoryStep] = useState(0);
  const [sellStoryPlaying, setSellStoryPlaying] = useState(true);
  useEffect(() => {
    Promise.all([api.get("/products/?sort=rating"), api.get("/categories/"), api.get("/reviews/featured/")]).then(([p, c, r]) => {
      setProducts(p.data.results || p.data);
      setProductCount(p.data.count ?? p.data.results?.length ?? p.data.length);
      setCategories(c.data.results || c.data);
      setReviews(r.data);
    }).catch((error) => notify(errorMessage(error))).finally(() => setLoading(false));
  }, [notify]);
  useEffect(() => {
    if (!sellStoryPlaying) return undefined;
    const interval = window.setInterval(() => setSellStoryStep((step) => (step + 1) % sellStorySteps.length), 3800);
    return () => window.clearInterval(interval);
  }, [sellStoryPlaying]);
  const icons = {
    mobiles: Smartphone,
    laptops: Laptop,
    books: BookOpen,
    tablets: Tablet,
    "smart-watches": Watch,
    "headphones-earbuds": Headphones,
    cameras: Camera,
  };
  const categoryOrder = ["mobiles", "laptops", "books", "tablets", "smart-watches", "headphones-earbuds", "cameras"];
  const orderedCategories = [...categories].sort((a, b) => categoryOrder.indexOf(a.slug) - categoryOrder.indexOf(b.slug));
  return <main className="home-main">
    <section className="hero-section relative overflow-hidden">
      <div className="hero-orbit hero-orbit-one" /><div className="hero-orbit hero-orbit-two" /><span className="hero-bubble hero-bubble-one" /><span className="hero-bubble hero-bubble-two" /><span className="hero-bubble hero-bubble-three" /><Leaf className="hero-leaf hero-leaf-one" /><Leaf className="hero-leaf hero-leaf-two" />
      <div className="relative mx-auto grid max-w-[1400px] items-center gap-8 px-5 pb-12 pt-9 sm:px-10 sm:pb-16 sm:pt-14 lg:grid-cols-[1.02fr_.98fr] lg:px-12 lg:py-16">
        <div className="hero-fade-in max-w-[620px]">
          <div className="hero-kicker mb-5 inline-flex items-center gap-2 rounded-full border border-[#dce8d3] bg-white/70 px-3 py-1.5 text-[11px] font-bold text-[#58794c]"><Sparkles size={14} /> GOOD FINDS, GREATER GOOD</div>
          <h1 className="hero-title font-display text-[42px] font-extrabold leading-[1.06] tracking-[-2.2px] text-[#203629] sm:text-6xl lg:text-[68px]"><span className="hero-title-line"><span className="hero-word">A</span> <span className="hero-word">second</span> <span className="hero-word">life.</span></span><br /><span className="hero-title-line"><span className="hero-highlight"><span className="hero-word">Well</span> <span className="hero-word">spent.</span></span></span></h1>
          <p className="hero-paragraph mt-5 max-w-[475px] text-sm leading-7 text-[#68796b] sm:text-base">Good tech and great reads, thoughtfully restored and ready for a new story. Better for your budget. A little kinder to the planet.</p>
          <div className="mt-7 flex flex-wrap gap-3"><Link to="/shop" className="button-primary hero-primary-cta inline-flex h-12 items-center gap-3 rounded-full px-6 text-sm font-bold text-white">Find your next thing <ArrowRight size={17} /></Link><Link to="/exchange" className="hero-trade-cta inline-flex h-12 items-center gap-2 rounded-full border border-[#cfdcc9] bg-white/75 px-5 text-sm font-bold text-[#47684c] hover:bg-white"><HeartHandshake className="hero-trade-icon" size={17} /> Trade yours in</Link></div>
          <div className="hero-social-proof mt-8 flex items-center gap-3"><div className="flex -space-x-2">{["customer-1", "customer-2", "customer-3"].map((name, index) => <img key={name} src={`/images/banners/${name}.jpg`} style={{ "--avatar-index": index }} className="hero-avatar size-8 rounded-full border-2 border-[#f1f5ec] object-cover" alt="" />)}</div><p className="text-xs text-[#778578]"><strong className="text-[#38523d]"><AnimatedCount value={productCount} /></strong> products in the catalogue</p></div>
        </div>
        <div className="hero-illustration-wrap relative mx-auto w-full max-w-[620px]">
          <div className="hero-illustration"><img src="/images/logo/logo.png" alt="ReNewKart logo: two hands holding a green box as a phone and laptop float out with sparkles" className="hero-hands-box" />
            <Sparkles className="hero-sparkle hero-sparkle-one" /><Sparkles className="hero-sparkle hero-sparkle-two" />
          </div>
          <div className="hero-price-badge"><span>Up to 40%</span><small>less than new</small></div>
          <div className="hero-check-badge"><span><ShieldCheck size={19} /></span><div><strong>Checked. Cleaned. Ready.</strong><small>Quality you can feel good about</small></div></div>
          <div className="hero-stories-badge"><Heart size={16} fill="currentColor" /><strong><AnimatedCount value={productCount} /></strong><small>products to explore</small></div>
        </div>
      </div>
    </section>
    <section className="sell-story-section">
      <div className="mx-auto max-w-[1400px] px-5 py-12 sm:px-10 sm:py-16 lg:px-12">
        <SectionHeading eyebrow="Turn your old tech into something new" title="How It Works - Old Things to Cash in 3 Steps" description="Four simple moments. One easy way to give your old devices a fresh start." />
        <SellStoryVisual step={sellStoryStep} playing={sellStoryPlaying} onToggle={() => setSellStoryPlaying((playing) => !playing)} />
        <div className="sell-story-step-picker" aria-label="Story scenes">
          {sellStorySteps.map((item, index) => <button key={item.title} type="button" onClick={() => setSellStoryStep(index)} aria-pressed={sellStoryStep === index} aria-label={`Show step ${index + 1}: ${item.title}`} className={sellStoryStep === index ? "is-active" : ""}>
            <span>0{index + 1}</span><span className="sell-story-step-name">{item.short}</span>
          </button>)}
        </div>
        <div className="sell-story-cta-wrap">
          <Link to="/exchange" className="button-primary sell-story-cta">Start Selling Now - Get Cash <ArrowRight size={18} /></Link>
        </div>
      </div>
    </section>
    <section className="mx-auto max-w-[1400px] px-5 py-14 sm:px-10 sm:py-20 lg:px-12">
      <SectionHeading eyebrow="A little something for everyone" title="Shop by category" description="Give good things another go—from your next upgrade to your next favourite read." action={<Link to="/shop" className="flex items-center gap-1 text-xs font-bold text-[#5b8051]">Browse all <ArrowRight size={15} /></Link>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{orderedCategories.map((category, index) => {
        const Icon = icons[category.slug] || Sparkles;
        const n = String(index + 1).padStart(2, "0");
        const categoryLink = `/shop?category=${category.slug}`;
        return <Link key={category.id} to={categoryLink} className={`category-card group relative min-h-[220px] overflow-hidden rounded-[22px] transition duration-300 hover:-rotate-1 hover:scale-[1.02] hover:shadow-lg ${index === 0 ? "bg-[#dce9d5]" : index === 1 ? "bg-[#e7ebe3]" : index === 2 ? "bg-[#f0e8d9]" : "bg-[#e3efe1]"}`}>
          <img src={localCategoryImage(category)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-[.19] mix-blend-multiply transition duration-500 group-hover:scale-105" />
          <div className="relative flex h-full min-h-[220px] flex-col justify-between p-5 sm:p-6"><div className="flex items-start justify-between"><span className="category-icon grid size-11 place-items-center rounded-[14px] bg-white/80 text-[#426849]"><Icon size={22} /></span><span className="text-xs font-bold text-[#577052]">{n}</span></div><div><h3 className="font-display text-2xl font-extrabold text-[#263b2d]">{category.name}</h3><p className="mt-1 max-w-[230px] text-xs leading-5 text-[#627364]">{category.description}</p><span className="mt-4 inline-flex items-center gap-1 text-xs font-extrabold text-[#436547]">Explore collection <ArrowRight size={14} className="transition group-hover:translate-x-1" /></span></div></div>
        </Link>;
      })}</div>
    </section>
    <section className="mx-auto max-w-[1400px] px-5 pb-14 sm:px-10 sm:pb-20 lg:px-12">
      <SectionHeading eyebrow="The good stuff goes fast" title="Loved by the second-time-around crowd" description="Every find is checked, cleaned and ready for a new chapter." action={<Link to="/shop" className="hidden items-center gap-1 text-xs font-bold text-[#5b8051] sm:flex">See all finds <ArrowRight size={15} /></Link>} />
      <ProductGrid products={products.slice(0, 4)} loading={loading} />
    </section>
    <section className="bg-[#eaf1e6]">
      <div className="mx-auto grid max-w-[1400px] gap-8 px-5 py-14 sm:px-10 sm:py-16 lg:grid-cols-[.8fr_1.2fr] lg:px-12">
        <div><p className="mb-2 text-[11px] font-extrabold uppercase tracking-[.18em] text-[#71905c]">As easy as it should be</p><h2 className="font-display text-3xl font-extrabold tracking-[-1px] text-[#203629]">A better buy,<br />in three easy steps.</h2><p className="mt-3 max-w-sm text-sm leading-6 text-[#6d7a6e]">No guesswork. No surprises. Just a good product making a fresh start.</p><Link to="/shop" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#4f7849]">Start browsing <ArrowRight size={16} /></Link></div>
        <div className="grid gap-3 sm:grid-cols-3">{[[Search, "Find your thing", "Browse quality-checked tech and books worth rediscovering."], [BadgeCheck, "We check every detail", "Each item is inspected, cleaned and honestly graded."], [Truck, "It comes to you", "Safe delivery, easy returns and a warranty to back it up."]].map(([Icon, title, copy], i) => <div key={title} className="rounded-[20px] bg-white p-5"><span className="grid size-10 place-items-center rounded-xl bg-[#e9f2e3] text-[#5c8550]"><Icon size={20} /></span><p className="mt-5 text-[10px] font-bold text-[#94a093]">0{i + 1}</p><h3 className="mt-1 font-display text-base font-extrabold text-[#2e4233]">{title}</h3><p className="mt-2 text-xs leading-5 text-[#7b877c]">{copy}</p></div>)}</div>
      </div>
    </section>
    <section className="mx-auto grid max-w-[1400px] gap-5 px-5 py-14 sm:px-10 lg:grid-cols-2 lg:px-12 lg:py-20">
      <div className="rounded-[26px] bg-[#294332] p-7 text-white sm:p-9"><span className="grid size-12 place-items-center rounded-2xl bg-white/10 text-[#b9d8a8]"><ShieldCheck size={24} /></span><h2 className="mt-5 font-display text-2xl font-extrabold">Not just a second-hand buy.<br />A better kind of buy.</h2><div className="mt-6 grid grid-cols-2 gap-4">{[["Quality checked", "Every single item"], ["6-month cover", "On tech that matters"], ["Thoughtful prices", "More for your money"], ["Less e-waste", "A lighter footprint"]].map(([a,b]) => <div key={a} className="border-t border-white/15 pt-3"><p className="text-sm font-bold">{a}</p><p className="mt-1 text-xs text-[#bbcabd]">{b}</p></div>)}</div></div>
      <div className="relative flex min-h-[310px] flex-col justify-end overflow-hidden rounded-[26px] bg-[#eee8d8] p-7 sm:p-9"><img src="/images/banners/trade-in-books.jpg" className="absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-multiply" alt="Pre-loved book and stationery" />      <div className="relative"><p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#6c875d]">Your old tech has a next</p><h2 className="mt-2 max-w-sm font-display text-3xl font-extrabold leading-tight text-[#263b2d]">Ready for your next chapter?</h2><p className="mt-2 max-w-sm text-sm leading-6 text-[#627363]">Trade in your old mobile or laptop. Get a fair estimate and give it a fresh start.</p><Link to="/exchange" className="button-primary mt-5 inline-flex items-center gap-2 rounded-full px-5 py-3 text-xs font-bold text-white">Get an estimate <ArrowRight size={15} /></Link></div></div>
    </section>
    <section className="mx-auto max-w-[1400px] px-5 pb-14 sm:px-10 lg:px-12">
      <SectionHeading eyebrow="Good words, good finds" title="Little love notes from our customers" />
      {reviews.length ? <div className="grid gap-4 sm:grid-cols-3">{reviews.slice(0, 3).map((review) => <blockquote key={review.id} className="rounded-[20px] border border-[#e9ede6] bg-white p-5"><div className="flex gap-0.5 text-[#dfa849]">{Array.from({ length: review.rating }).map((_, i) => <Star key={i} size={14} fill="currentColor" />)}</div><p className="mt-4 text-sm leading-6 text-[#536156]">“{review.comment}”</p><footer className="mt-5 border-t border-[#edf0ea] pt-4"><p className="text-xs font-extrabold text-[#304333]">{review.user_name || "Customer"}</p><Link to={`/product/${review.product_slug}`} className="mt-1 inline-flex items-center gap-1 text-[10px] text-[#89948a] hover:text-[#5b8051]">Verified purchase · {review.product_name}<ArrowRight size={11} /></Link></footer></blockquote>)}</div> : <div className="rounded-[20px] border border-dashed border-[#d9e1d6] bg-white p-8 text-center"><p className="text-sm font-bold text-[#536156]">The first review is still waiting to be written.</p><p className="mt-2 text-xs text-[#89948a]">Have you found something you love? We’d love to hear what you think.</p><Link to="/shop" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#5b8051]">Explore the shop <ArrowRight size={13} /></Link></div>}
    </section>
  </main>;
}

function Shop() {
  const { notify } = useStore();
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productError, setProductError] = useState("");
  const [filters, setFilters] = useState({ search: params.get("search") || "", category: params.get("category") || "", brand: "", condition: "", min_price: params.get("min_price") || "", max_price: params.get("max_price") || "", sort: "newest" });
  useEffect(() => { api.get("/categories/").then(({ data }) => setCategories(data.results || data)).catch((error) => notify(errorMessage(error))); }, [notify]);
  useEffect(() => {
    const category = params.get("category") || "";
    const minPrice = params.get("min_price") || "";
    const maxPrice = params.get("max_price") || "";
    setFilters((state) => ({
      ...state,
      search: params.get("search") || "",
      category,
      min_price: category !== state.category ? "" : minPrice,
      max_price: category !== state.category ? "" : maxPrice,
    }));
  }, [params]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setProductError("");
    const query = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ""));
    api.get("/products/", { params: query, signal: controller.signal }).then(({ data }) => setProducts(data.results || data)).catch((error) => {
      if (controller.signal.aborted) return;
      setProducts([]);
      setProductError(errorMessage(error));
      notify(errorMessage(error));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [filters, notify]);
  const update = (key, value) => setFilters((state) => ({ ...state, [key]: value }));
  const brands = [...new Set(products.map((product) => product.brand).filter(Boolean))].sort();
  const applyPriceFilter = (minPrice, maxPrice) => setFilters((state) => ({ ...state, min_price: minPrice, max_price: maxPrice }));
  const clearPriceFilter = () => setFilters((state) => ({ ...state, min_price: "", max_price: "" }));
  const categoryLabel = categories.find((category) => category.slug.toLowerCase() === filters.category.toLowerCase() || category.name.toLowerCase() === filters.category.toLowerCase())?.name || filters.category;
  const reset = () => { setFilters({ search: "", category: "", brand: "", condition: "", min_price: "", max_price: "", sort: "newest" }); setParams({}); };
  return <main><PageIntro eyebrow="The good finds are here" title="Shop the second life." text="Everything here is inspected, graded and ready for a new home. Find the one that feels right." />
    <div className="mx-auto max-w-[1400px] px-5 py-9 sm:px-10 lg:px-12">
      <PriceRangeFilter min={filters.min_price} max={filters.max_price} onApply={applyPriceFilter} onClear={clearPriceFilter} />
      <div className="mt-5">
          <div className="mb-7 grid gap-3 rounded-2xl border border-[#e7ebe4] bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
            <label className="relative sm:col-span-2 lg:col-span-2"><Search size={16} className="absolute left-3 top-3.5 text-[#93a093]" /><input value={filters.search} onChange={(e) => update("search", e.target.value)} placeholder="Search by name or brand" className="h-11 w-full rounded-xl border border-[#e8ede6] pl-9 pr-3 text-sm outline-none focus:border-[#9dbb91]" /></label>
            <select value={filters.category} onChange={(e) => update("category", e.target.value)} className="h-11 rounded-xl border border-[#e8ede6] bg-white px-3 text-sm text-[#536156]"><option value="">All categories</option>{categories.filter((c) => c.slug !== "exchange-zone").map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}</select>
            <select value={filters.condition} onChange={(e) => update("condition", e.target.value)} className="h-11 rounded-xl border border-[#e8ede6] bg-white px-3 text-sm text-[#536156]"><option value="">Any condition</option><option value="like_new">Like New</option><option value="good">Good</option><option value="average">Average</option></select>
            <select value={filters.brand} onChange={(e) => update("brand", e.target.value)} className="h-11 rounded-xl border border-[#e8ede6] bg-white px-3 text-sm text-[#536156]"><option value="">Any brand</option>{brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}</select>
            <select value={filters.sort} onChange={(e) => update("sort", e.target.value)} className="h-11 rounded-xl border border-[#e8ede6] bg-white px-3 text-sm text-[#536156]"><option value="newest">Newest first</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="rating">Top rated</option></select>
            <button onClick={reset} className="h-11 rounded-xl bg-[#edf3e9] px-4 text-sm font-bold text-[#54734c] hover:bg-[#e1eddc]">Clear filters</button>
          </div>
          <p className="mb-4 text-xs text-[#889488]">{loading ? "Finding good things..." : `${products.length} find${products.length === 1 ? "" : "s"} for you`}</p>
          {!loading && productError ? <div role="alert" className="rounded-3xl border border-dashed border-[#d7e0d4] bg-white py-16 text-center text-sm text-[#758276]">{productError}</div>
            : !loading && !products.length && filters.category ? <div className="rounded-3xl border border-dashed border-[#d7e0d4] bg-white py-16 text-center"><h2 className="font-display text-lg font-extrabold text-[#344737]">Coming Soon - No products in {categoryLabel} yet</h2><p className="mt-2 text-sm text-[#758276]">We’re getting this collection ready for you.</p><Link to="/shop" className="button-primary mt-5 inline-flex rounded-full px-5 py-3 text-xs font-bold text-white">View All Products</Link></div>
              : <ProductGrid products={products} loading={loading} />}
      </div>
    </div>
  </main>;
}

function ProductPage() {
  const { slug } = useParams();
  const { addCart, toggleWish, wish, user, notify, refreshCounts } = useStore();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [emiMonths, setEmiMonths] = useState(12);
  useEffect(() => { api.get(`/products/${slug}/`).then(({ data }) => setProduct(data)).catch((error) => { setProduct(false); notify(errorMessage(error)); }); }, [slug, notify]);
  if (product === null) return <LoadingPage />;
  if (!product) return <NotFound />;
  const saved = wish.some((item) => item.product.id === product.id);
  const buyNow = async () => {
    if (!user) {
      notify("Sign in to continue with your purchase.");
      navigate("/login");
      return;
    }
    try {
      await api.post("/cart/", { product_id: product.id, quantity });
      await refreshCounts();
      navigate("/checkout");
    } catch (error) { notify(errorMessage(error)); }
  };
  const submitReview = async (e) => {
    e.preventDefault();
    try { await api.post(`/products/${product.id}/reviews/`, { rating, comment }); setComment(""); setProduct((p) => ({ ...p, reviews: [{ user_name: user.first_name, rating, comment, created_at: new Date().toISOString() }, ...p.reviews], ratings_count: p.ratings_count + 1 })); notify("Thanks for sharing your review."); }
    catch (error) { notify(errorMessage(error)); }
  };
  const allImages = [localProductImage(product)];
  return <main className="mx-auto max-w-[1400px] px-5 py-8 sm:px-10 lg:px-12">
    <Link to="/shop" className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-[#708072] hover:text-[#426348]"><ArrowLeft size={15} /> Back to the shop</Link>
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
      <div><div className="overflow-hidden rounded-[26px] bg-[#eff2ed]"><img src={localProductImage(product)} alt={product.name} className="aspect-[1/0.85] w-full object-cover" onError={(e) => { e.currentTarget.src = imageFallback; }} /></div>{allImages.length > 1 && <div className="mt-3 grid grid-cols-4 gap-3">{allImages.map((url, i) => <img key={`${url}-${i}`} src={url} alt={`${product.name} view ${i + 1}`} className="aspect-square w-full rounded-xl object-cover" />)}</div>}</div>
      <div className="py-2">
        <span className="inline-flex rounded-full bg-[#e7f0e2] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.08em] text-[#53784b]">{conditionText[product.condition] || product.condition_label} condition</span>
        <p className="mt-5 text-xs font-bold uppercase tracking-[.16em] text-[#8c998d]">{product.brand} · {product.category_name}</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-1.2px] text-[#23372b] sm:text-4xl">{product.name}</h1>
        <div className="mt-4 flex items-center gap-2 text-sm"><span className="flex items-center gap-1 font-bold text-[#405542]"><Star size={15} className="fill-[#dca647] text-[#dca647]" />{Number(product.rating).toFixed(1)}</span><span className="text-xs text-[#8e9a8f]">({product.ratings_count} reviews)</span></div>
        <div className="mt-6 flex flex-wrap items-end gap-3"><p className="font-display text-3xl font-extrabold text-[#24382b]">{money(product.price)}</p>{product.old_price && <p className="pb-1 text-lg text-[#9ca69c] line-through">{money(product.old_price)}</p>}{product.old_price && <span className="mb-1 rounded-full bg-[#e7f0e2] px-2.5 py-1 text-[10px] font-bold text-[#547849]">Save {money(product.old_price - product.price)}</span>}</div>
        <p className="mt-2 text-sm font-bold text-[#2f7d32]">EMI Available: ₹{Math.round(Number(product.price) / 12).toLocaleString("en-IN")} / month - 12 Months</p>
        <div className="mt-4 max-w-lg rounded-2xl border border-[#dfe7dd] bg-white p-4">
          <h2 className="font-display text-sm font-extrabold text-[#304334]">EMI Calculator</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[3, 6, 12].map((months) => <button
              type="button"
              key={months}
              onClick={() => setEmiMonths(months)}
              aria-pressed={emiMonths === months}
              className={`rounded-full border px-2 py-2 text-xs font-bold ${emiMonths === months ? "border-[#50754a] bg-[#50754a] text-white" : "border-[#dfe7dd] bg-[#f8faf6] text-[#526056]"}`}
            >{months} Months</button>)}
          </div>
          <p className="mt-3 text-sm font-extrabold text-[#304334]">Monthly: ₹{Math.round(Number(product.price) / emiMonths).toLocaleString("en-IN")} / month</p>
          <p className="mt-2 text-[11px] leading-5 text-[#6e7c70]">UPI, cards, and EMI options are available. No Cost EMI is available.</p>
        </div>
        <p className="mt-5 max-w-xl text-sm leading-7 text-[#6e7c70]">{product.description}</p>
        <div className="mt-6 grid max-w-lg gap-3 rounded-2xl bg-[#f0f4ed] p-4 sm:grid-cols-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#526852]"><ShieldCheck size={17} className="text-[#71935e]" />{product.warranty}</div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#526852]"><PackageCheck size={17} className="text-[#71935e]" />{product.stock ? `${product.stock} available` : "Currently out of stock"}</div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#526852]"><Truck size={17} className="text-[#71935e]" />Free delivery over ₹999</div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#526852]"><BadgeCheck size={17} className="text-[#71935e]" />Inspected & quality checked</div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="flex h-12 items-center rounded-full border border-[#dfe7dd] bg-white"><button aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="grid size-11 place-items-center text-[#637466] disabled:opacity-30"><Minus size={16} /></button><span className="w-5 text-center text-sm font-bold">{quantity}</span><button aria-label="Increase quantity" disabled={quantity >= product.stock} onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))} className="grid size-11 place-items-center text-[#637466] disabled:opacity-30"><Plus size={16} /></button></div>
          <button disabled={!product.stock} onClick={() => addCart(product, quantity)} className="button-primary add-to-cart-button inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><ShoppingBag size={17} /> Add to cart</button>
          <button disabled={!product.stock} onClick={buyNow} className="button-primary h-12 rounded-full px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Buy now</button>
          <button onClick={() => toggleWish(product)} aria-label="Toggle wishlist" className={`grid size-12 place-items-center rounded-full border ${saved ? "border-[#e8c9c6] bg-[#fff3f1] text-[#d6655e]" : "border-[#dfe7dd] bg-white text-[#526056]"}`}><Heart size={18} fill={saved ? "currentColor" : "none"} /></button>
        </div>
      </div>
    </div>
    <section className="mt-16 border-t border-[#e6ebe3] pt-10">
      <SectionHeading eyebrow="From people who've been there" title="Ratings & reviews" />
      <div className="grid gap-8 lg:grid-cols-[.7fr_1.3fr]">
        <div>{user && <form onSubmit={submitReview} className="rounded-2xl border border-[#e7ebe4] bg-white p-5"><h3 className="font-display font-extrabold">Leave a review</h3><p className="mt-1 text-xs text-[#849084]">Reviews are available to customers who purchased this item.</p><div className="mt-4 flex gap-1">{[1,2,3,4,5].map((n) => <button type="button" key={n} aria-label={`${n} stars`} onClick={() => setRating(n)}><Star size={21} className={n <= rating ? "fill-[#dfa849] text-[#dfa849]" : "text-[#cbd3c8]"} /></button>)}</div><textarea value={comment} onChange={(e) => setComment(e.target.value)} required minLength={5} rows={4} placeholder="What did you think?" className="mt-4 w-full resize-y rounded-xl border border-[#e4e9e1] p-3 text-sm outline-none focus:border-[#a4bf99]" /><button className="mt-3 rounded-full bg-[#294332] px-5 py-2.5 text-xs font-bold text-white">Post review</button></form>}</div>
        <div className="space-y-3">{product.reviews?.length ? product.reviews.map((review) => <div key={review.id || review.created_at} className="rounded-2xl border border-[#e8ede6] bg-white p-5"><div className="flex items-center justify-between"><p className="text-sm font-bold text-[#384a3b]">{review.user_name || "Customer"}</p><span className="flex items-center gap-1 text-xs font-bold text-[#596859]"><Star size={13} className="fill-[#dfa849] text-[#dfa849]" />{review.rating}</span></div><p className="mt-2 text-sm leading-6 text-[#748075]">{review.comment}</p></div>) : <div className="rounded-2xl border border-dashed border-[#d9e1d6] p-8 text-center text-sm text-[#819081]">No reviews yet. Be the first to share your experience after your purchase.</div>}</div>
      </div>
    </section>
  </main>;
}

function CartPage() {
  const { cart, refreshCounts, notify } = useStore();
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const subtotal = cart.reduce((sum, item) => sum + Number(item.line_total), 0);
  const discount = applied ? subtotal * applied.discount_percent / 100 : 0;
  const changeQuantity = async (item, quantity) => {
    try { await api.patch("/cart/", { item_id: item.id, quantity }); await refreshCounts(); }
    catch (error) { notify(errorMessage(error)); }
  };
  const remove = async (item) => {
    try { await api.delete(`/cart/?item_id=${item.id}`); await refreshCounts(); notify("Item removed."); }
    catch (error) { notify(errorMessage(error)); }
  };
  const applyCoupon = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { const { data } = await api.post("/coupons/check/", { code: coupon }); setApplied(data); notify(`${data.discount_percent}% discount applied.`); }
    catch (error) { setApplied(null); notify(errorMessage(error)); }
    finally { setBusy(false); }
  };
  return <main><PageIntro eyebrow="Your good finds" title="Your cart." text="A few more steps and these finds will be on their way to you." /><div className="mx-auto grid max-w-[1200px] gap-7 px-5 py-9 sm:px-10 lg:grid-cols-[1.5fr_.8fr] lg:px-12">
    <div className="space-y-3">{cart.length ? cart.map((item) => <article key={item.id} className="flex gap-4 rounded-[20px] border border-[#e8ede5] bg-white p-3 sm:gap-5 sm:p-4"><Link to={`/product/${item.product.slug}`} className="size-24 shrink-0 overflow-hidden rounded-2xl bg-[#eff2ed] sm:size-32"><img src={localProductImage(item.product)} alt={item.product.name} className="h-full w-full object-cover" /></Link><div className="flex min-w-0 flex-1 flex-col justify-between py-1"><div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#95a095]">{item.product.brand}</p><Link to={`/product/${item.product.slug}`} className="mt-1 line-clamp-2 font-display text-sm font-extrabold text-[#304334]">{item.product.name}</Link><p className="mt-1 text-[10px] text-[#829082]">{conditionText[item.product.condition]} condition</p></div><button onClick={() => remove(item)} aria-label="Remove item" className="p-1 text-[#a3ada3] hover:text-[#c76058]"><Trash2 size={17} /></button></div><div className="mt-2 flex items-end justify-between gap-2"><div className="flex h-8 items-center rounded-full border border-[#e4e9e2]"><button onClick={() => changeQuantity(item, Math.max(1, item.quantity - 1))} disabled={item.quantity <= 1} aria-label="Decrease quantity" className="grid size-8 place-items-center disabled:opacity-30"><Minus size={13} /></button><span className="w-5 text-center text-xs font-bold">{item.quantity}</span><button onClick={() => changeQuantity(item, item.quantity + 1)} aria-label="Increase quantity" className="grid size-8 place-items-center"><Plus size={13} /></button></div><p className="font-display text-base font-extrabold text-[#304334]">{money(item.line_total)}</p></div></div></article>) : <EmptyState icon={ShoppingBag} title="Nothing in your cart just yet." text="Your next great find is waiting." action={<Link to="/shop" className="button-primary rounded-full px-5 py-3 text-xs font-bold text-white">Explore the shop</Link>} />}
    </div>
    {cart.length > 0 && <aside className="h-fit rounded-[22px] border border-[#e8ede5] bg-white p-5 sm:p-6"><h2 className="font-display text-lg font-extrabold text-[#304334]">Order summary</h2><form onSubmit={applyCoupon} className="mt-5 flex gap-2"><input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Coupon code" className="h-10 min-w-0 flex-1 rounded-xl border border-[#e5eae3] px-3 text-xs outline-none focus:border-[#9bb990]" /><button disabled={busy} className="rounded-xl bg-[#edf3e9] px-4 text-xs font-bold text-[#54734c]">{busy ? "..." : "Apply"}</button></form>{applied && <p className="mt-2 text-[11px] font-semibold text-[#56804b]">{applied.code} · {applied.discount_percent}% off</p>}<div className="mt-5 space-y-3 border-t border-[#edf0eb] pt-4 text-sm"><div className="flex justify-between text-[#758176]"><span>Subtotal</span><span>{money(subtotal)}</span></div>{applied && <div className="flex justify-between text-[#56804b]"><span>Discount</span><span>−{money(discount)}</span></div>}<div className="flex justify-between text-[#758176]"><span>Delivery</span><span className="font-bold text-[#56804b]">Free</span></div><div className="flex justify-between border-t border-[#edf0eb] pt-4 font-extrabold text-[#304334]"><span>Total</span><span>{money(subtotal - discount)}</span></div></div><button onClick={() => navigate("/checkout", { state: { couponCode: applied?.code || "" } })} className="button-primary mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold text-white">Continue to checkout <ArrowRight size={16} /></button><p className="mt-3 text-center text-[10px] leading-5 text-[#94a095]">Secure checkout · 6-month warranty on tech</p></aside>}
  </div></main>;
}

function Checkout() {
  const { cart, user, notify, refreshCounts } = useStore();
  const [addresses, setAddresses] = useState([]);
  const [selected, setSelected] = useState("");
  const [form, setForm] = useState({ full_name: user?.first_name || "", phone: "", line1: "", line2: "", city: "", state: "", postal_code: "", is_default: true });
  const [showForm, setShowForm] = useState(false);
  const [payment, setPayment] = useState("cod");
  const [busy, setBusy] = useState(false);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const subtotal = cart.reduce((sum, item) => sum + Number(item.line_total), 0);
  const couponCode = searchParams.get("coupon") || location.state?.couponCode || "";
  const [coupon, setCoupon] = useState(null);
  useEffect(() => {
    if (!user || !couponCode) { setCoupon(null); return; }
    api.post("/coupons/check/", { code: couponCode }).then(({ data }) => setCoupon(data)).catch((error) => { setCoupon(null); notify(errorMessage(error)); });
  }, [couponCode, notify, user]);
  const discount = coupon ? subtotal * coupon.discount_percent / 100 : 0;
  useEffect(() => {
    if (!user) return;
    api.get("/addresses/").then(({ data }) => {
      setAddresses(data.results || data);
      const first = (data.results || data).find((a) => a.is_default) || (data.results || data)[0];
      if (first) setSelected(String(first.id));
      else setShowForm(true);
    }).catch((error) => { setShowForm(true); notify(errorMessage(error)); });
  }, [notify, user]);
  const update = (key, value) => setForm((state) => ({ ...state, [key]: value }));
  const placeOrder = async (event) => {
    event.preventDefault();
    if (!cart.length) { notify("Your cart is empty."); navigate("/shop"); return; }
    setBusy(true);
    try {
      let addressId = selected;
      if (showForm || !addressId) {
        const { data } = await api.post("/addresses/", form);
        addressId = data.id;
        setAddresses((old) => [...old, data]);
        setSelected(String(data.id));
        setShowForm(false);
      }
      if (payment === "cod") {
        const { data } = await api.post("/orders/", { address_id: Number(addressId), payment_method: "cod", coupon_code: couponCode });
        await refreshCounts();
        navigate(`/orders/${data.order_number}`, { state: { justPlaced: true } });
      } else {
        await loadRazorpay();
        const { data } = await api.post("/payments/razorpay/create/", { address_id: Number(addressId), coupon_code: couponCode });
        const checkout = new window.Razorpay({
          key: data.key_id,
          amount: data.amount,
          currency: data.currency,
          name: "ReNewKart",
          description: `Order ${data.order.order_number}`,
          order_id: data.razorpay_order_id,
          prefill: { name: data.name, email: data.email },
          theme: { color: "#16a34a" },
          handler: async (response) => {
            try {
              const verified = await api.post("/payments/razorpay/verify/", { ...response, order_number: data.order.order_number });
              await refreshCounts();
              navigate(`/orders/${verified.data.order_number}`, { state: { justPlaced: true } });
            } catch (error) { notify(errorMessage(error)); }
          },
          modal: { ondismiss: () => notify("Payment window closed. Your order is still pending payment.") },
        });
        checkout.on("payment.failed", ({ error }) => {
          notify(error?.description || error?.reason || "Payment failed. Please try again or choose Cash on Delivery.");
        });
        checkout.open();
      }
    } catch (error) { notify(errorMessage(error)); }
    finally { setBusy(false); }
  };
  if (!user) return <main><PageIntro eyebrow="Almost yours" title="Checkout." text="Sign in to continue to your secure checkout." /><div className="mx-auto max-w-3xl px-5 py-10"><SignInPrompt /></div></main>;
  return <main><PageIntro eyebrow="Almost yours" title="Checkout." text="Your next favourite thing is just around the corner." />
    <form onSubmit={placeOrder} className="mx-auto grid max-w-[1200px] gap-7 px-5 py-9 sm:px-10 lg:grid-cols-[1.35fr_.8fr] lg:px-12">
      <div className="space-y-5">
        <section className="rounded-[22px] border border-[#e8ede5] bg-white p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#7d9674]">Step 01</p><h2 className="mt-1 font-display text-lg font-extrabold text-[#304334]">Delivery address</h2></div><MapPin size={20} className="text-[#72915f]" /></div>
          {addresses.length > 0 && !showForm && <div className="mt-4 space-y-2">{addresses.map((a) => <label key={a.id} className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${String(a.id) === selected ? "border-[#8faf7f] bg-[#f4f8f1]" : "border-[#e9ede7]"}`}><input type="radio" name="address" checked={String(a.id) === selected} onChange={() => setSelected(String(a.id))} className="accent-[#50754a]" /><span className="text-xs leading-5 text-[#627163]"><b className="text-[#344737]">{a.full_name} · {a.phone}</b><br />{a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.postal_code}</span></label>)}</div>}
          {(showForm || !addresses.length) && <div className="mt-4 grid gap-3 sm:grid-cols-2">{[["full_name","Full name"],["phone","Phone number"],["line1","Address line 1"],["line2","Address line 2 (optional)"],["city","City"],["state","State"],["postal_code","PIN code"]].map(([key,label]) => <input key={key} value={form[key]} onChange={(e) => update(key,e.target.value)} required={key !== "line2"} placeholder={label} className={`h-11 rounded-xl border border-[#e4eae1] px-3 text-sm outline-none focus:border-[#9bb990] ${["line1","line2"].includes(key) ? "sm:col-span-2" : ""}`} />)}</div>}
          {addresses.length > 0 && <button type="button" onClick={() => setShowForm(!showForm)} className="mt-4 text-xs font-bold text-[#5a8050]">{showForm ? "Use a saved address" : "+ Add a new address"}</button>}
        </section>
        <section className="rounded-[22px] border border-[#e8ede5] bg-white p-5 sm:p-6"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#7d9674]">Step 02</p><h2 className="mt-1 font-display text-lg font-extrabold text-[#304334]">Payment method</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{[["cod", "Cash on Delivery", "Pay when your order arrives", Truck], ["razorpay", "Razorpay", "UPI, cards & net banking", LockKeyhole]].map(([key,title,desc,Icon]) => <label key={key} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${payment === key ? "border-[#8faf7f] bg-[#f4f8f1]" : "border-[#e9ede7]"}`}><input type="radio" name="payment" value={key} checked={payment === key} onChange={() => setPayment(key)} className="mt-1 accent-[#50754a]" /><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e8f0e3] text-[#5b8051]"><Icon size={17} /></span><span><b className="text-xs text-[#354738]">{title}</b><span className="mt-1 block text-[10px] text-[#89958a]">{desc}</span></span></label>)}</div></section>
      </div>
      <aside className="h-fit rounded-[22px] border border-[#e8ede5] bg-white p-5 sm:p-6"><h2 className="font-display text-lg font-extrabold text-[#304334]">Your order</h2><div className="mt-4 max-h-64 space-y-3 overflow-auto">{cart.map((item) => <div key={item.id} className="flex items-center gap-3"><img src={localProductImage(item.product)} alt="" className="size-12 rounded-xl object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-[#405143]">{item.product.name}</p><p className="text-[10px] text-[#8b978c]">Qty {item.quantity}</p></div><b className="text-xs text-[#405143]">{money(item.line_total)}</b></div>)}</div><div className="mt-4 space-y-3 border-t border-[#edf0eb] pt-4 text-sm"><div className="flex justify-between text-[#758176]"><span>Subtotal</span><span>{money(subtotal)}</span></div>{coupon && <div className="flex justify-between text-[#56804b]"><span>Coupon · {coupon.code} ({coupon.discount_percent}%)</span><span>−{money(discount)}</span></div>}<div className="flex justify-between text-[#758176]"><span>Delivery</span><span className="font-bold text-[#56804b]">Free</span></div><div className="flex justify-between border-t border-[#edf0eb] pt-4 font-extrabold text-[#304334]"><span>Total</span><span>{money(subtotal - discount)}</span></div></div><button disabled={busy || !cart.length} className="button-primary mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold text-white disabled:opacity-50">{busy ? "Placing order..." : payment === "cod" ? "Place order" : "Continue to payment"}<ArrowRight size={16} /></button><p className="mt-3 text-center text-[10px] text-[#94a095]">Your information is encrypted and secure.</p></aside>
    </form>
  </main>;
}
let razorpayScriptPromise;

async function loadRazorpay() {
  if (window.Razorpay) return;
  if (!razorpayScriptPromise) {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    razorpayScriptPromise = new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = () => {
        script.remove();
        razorpayScriptPromise = null;
        reject(new Error("Could not load Razorpay checkout. Check your internet connection and try again."));
      };
      document.body.appendChild(script);
    });
  }
  await razorpayScriptPromise;
  if (!window.Razorpay) {
    razorpayScriptPromise = null;
    throw new Error("Razorpay checkout did not initialize. Please try again.");
  }
}

function Orders() {
  const { user, notify } = useStore();
  const [orders, setOrders] = useState(null);
  useEffect(() => {
    if (!user) return;
    api.get("/orders/").then(({ data }) => setOrders(data.results || data)).catch((error) => { setOrders([]); notify(errorMessage(error)); });
  }, [notify, user]);
  return <main><PageIntro eyebrow="Your ReNewKart journey" title="My orders." text="Track your finds from our door to yours." /><div className="mx-auto max-w-[1100px] px-5 py-9 sm:px-10 lg:px-12">{!user ? <SignInPrompt /> : orders === null ? <LoadingPage /> : orders.length ? <div className="space-y-4">{orders.map((order) => <Link key={order.id} to={`/orders/${order.order_number}`} className="block rounded-[20px] border border-[#e8ede5] bg-white p-5 transition hover:shadow-md sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#89978a]">Order {order.order_number}</p><p className="mt-1 font-display text-lg font-extrabold text-[#304334]">{money(order.total)}</p><p className="mt-1 text-xs text-[#849084]">{new Date(order.created_at).toLocaleDateString("en-IN", { dateStyle: "long" })} · {order.items.length} item(s)</p></div><span className="rounded-full bg-[#e9f1e4] px-3 py-1.5 text-[10px] font-extrabold capitalize text-[#55774c]">{order.status}</span></div><div className="mt-4 flex items-center justify-between gap-3 border-t border-[#edf0eb] pt-4"><div className="flex -space-x-2">{order.items.slice(0,4).map((item) => <img key={item.id} src={localProductImage({ image: item.image, product_name: item.product_name })} alt={item.product_name} className="size-10 rounded-xl border-2 border-white object-cover" />)}</div><span className="flex items-center gap-1 text-xs font-bold text-[#5f8055]">View order <ChevronRight size={15} /></span></div></Link>)}</div> : <EmptyState icon={PackageCheck} title="Your order list is taking a breather." text="Once you find something you love, it will show up here." action={<Link to="/shop" className="button-primary rounded-full px-5 py-3 text-xs font-bold text-white">Find your next thing</Link>} />}</div></main>;
}

function OrderDetail() {
  const { orderNumber } = useParams();
  const { user, notify } = useStore();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    api.get(`/orders/${orderNumber}/`).then(({ data }) => setOrder(data)).catch((error) => { setOrder(false); notify(errorMessage(error)); }).finally(() => setLoading(false));
  }, [orderNumber, notify, user]);
  if (!user) return <main className="mx-auto max-w-3xl px-5 py-12"><SignInPrompt /></main>;
  if (loading) return <LoadingPage />;
  if (!order) return <NotFound />;
  const steps = ["pending", "confirmed", "shipped", "delivered"];
  const canceled = order.status === "cancelled";
  const current = steps.indexOf(order.status);
  return <main className="mx-auto max-w-[1100px] px-5 py-10 sm:px-10 lg:px-12">
    <Link to="/orders" className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-[#708072]"><ArrowLeft size={15} /> All orders</Link>
    <div className="rounded-[24px] border border-[#e8ede5] bg-white p-5 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#89978a]">Order placed {new Date(order.created_at).toLocaleDateString("en-IN", { dateStyle: "long" })}</p><h1 className="mt-2 font-display text-2xl font-extrabold text-[#304334]">{order.order_number}</h1></div><span className={`rounded-full px-3 py-1.5 text-[10px] font-extrabold capitalize ${canceled ? "bg-[#fae9e7] text-[#aa574f]" : "bg-[#e9f1e4] text-[#55774c]"}`}>{order.status}</span></div>
      {!canceled ? <div className="my-9 grid grid-cols-4">{steps.map((step, i) => <div key={step} className="relative text-center">{i > 0 && <div className={`absolute left-[-50%] top-4 h-0.5 w-full ${current >= i ? "bg-[#76a169]" : "bg-[#e4eae1]"}`} />}<span className={`relative mx-auto grid size-8 place-items-center rounded-full ${current >= i ? "bg-[#5f8954] text-white" : "bg-[#edf1ea] text-[#95a193]"}`}>{current >= i ? <Check size={15} /> : <span className="text-[10px] font-bold">{i + 1}</span>}</span><p className={`mt-2 text-[10px] font-bold capitalize sm:text-xs ${current >= i ? "text-[#456849]" : "text-[#9aa39a]"}`}>{step}</p></div>)}</div> : <p className="my-7 rounded-xl bg-[#fff4f2] p-4 text-sm text-[#9e5e55]">This order was cancelled. Contact our support team if you have any questions.</p>}
      <div className="grid gap-7 border-t border-[#edf0eb] pt-6 sm:grid-cols-[1.3fr_.7fr]"><div><h2 className="font-display font-extrabold text-[#304334]">Items in this order</h2><div className="mt-3 space-y-3">{order.items.map((item) => <div key={item.id} className="flex items-center gap-3"><img src={localProductImage({ image: item.image, product_name: item.product_name })} alt="" className="size-14 rounded-xl object-cover" /><div className="flex-1"><p className="text-sm font-bold text-[#455648]">{item.product_name}</p><p className="mt-1 text-xs text-[#879387]">Qty {item.quantity}</p></div><b className="text-sm">{money(item.price * item.quantity)}</b></div>)}</div></div><div><h2 className="font-display font-extrabold text-[#304334]">Delivery & payment</h2><p className="mt-3 text-xs leading-6 text-[#718073]">{order.shipping_address.full_name}<br />{order.shipping_address.line1}, {order.shipping_address.line2 && `${order.shipping_address.line2}, `}{order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postal_code}<br />{order.shipping_address.phone}</p><p className="mt-3 text-xs text-[#718073]">{order.payment_method === "cod" ? "Cash on delivery" : "Razorpay"} · <span className="capitalize">{order.payment_status}</span></p><p className="mt-4 flex justify-between border-t border-[#edf0eb] pt-3 font-extrabold text-[#304334]"><span>Total</span><span>{money(order.total)}</span></p></div></div>
    </div>
  </main>;
}

function Profile() {
  const { user, setUser, signOut, notify } = useStore();
  const [profile, setProfile] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ full_name: "", phone: "", line1: "", line2: "", city: "", state: "", postal_code: "", is_default: false });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!user) return;
    Promise.all([api.get("/profile/"), api.get("/addresses/")]).then(([u,a]) => { setProfile(u.data); setAddresses(a.data.results || a.data); }).catch((error) => notify(errorMessage(error)));
  }, [user, notify]);
  if (!user) return <main><PageIntro eyebrow="Your account" title="My profile." /><div className="mx-auto max-w-3xl px-5 py-10"><SignInPrompt /></div></main>;
  const saveProfile = async (e) => {
    e.preventDefault();
    try { const { data } = await api.patch("/profile/", profile); setProfile(data); setUser(data); notify("Profile updated."); }
    catch (error) { notify(errorMessage(error)); }
  };
  const saveAddress = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const response = editing ? await api.patch(`/addresses/${editing}/`, form) : await api.post("/addresses/", form);
      setAddresses((old) => editing ? old.map((a) => a.id === editing ? response.data : a) : [...old, response.data]);
      setEditing(null); setForm({ full_name: "", phone: "", line1: "", line2: "", city: "", state: "", postal_code: "", is_default: false }); notify("Address saved.");
    } catch (error) { notify(errorMessage(error)); } finally { setBusy(false); }
  };
  const editAddress = (address) => { setEditing(address.id); setForm(address); };
  const deleteAddress = async (id) => {
    try { await api.delete(`/addresses/${id}/`); setAddresses((old) => old.filter((a) => a.id !== id)); notify("Address removed."); }
    catch (error) { notify(errorMessage(error)); }
  };
  const fields = [["full_name","Full name"],["phone","Phone"],["line1","Address line 1"],["line2","Address line 2"],["city","City"],["state","State"],["postal_code","PIN code"]];
  return <main><PageIntro eyebrow="Your account, your way" title={`Hello, ${user.first_name || "there"}.`} text="Keep your details up to date and your delivery addresses close at hand." />
    <div className="mx-auto grid max-w-[1200px] gap-6 px-5 py-9 sm:px-10 lg:grid-cols-[.8fr_1.2fr] lg:px-12">
      <div className="space-y-5"><form onSubmit={saveProfile} className="rounded-[22px] border border-[#e8ede5] bg-white p-5 sm:p-6"><div className="flex items-center justify-between"><h2 className="font-display text-lg font-extrabold text-[#304334]">Profile details</h2><button type="button" onClick={signOut} className="flex items-center gap-1.5 text-xs font-bold text-[#889488] hover:text-[#bb5d55]"><LogOut size={14} /> Sign out</button></div>{profile && <div className="mt-5 space-y-3"><label className="block text-xs font-semibold text-[#6d7a6e]">First name<input value={profile.first_name} onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-[#e4eae1] px-3 text-sm outline-none focus:border-[#9bb990]" /></label><label className="block text-xs font-semibold text-[#6d7a6e]">Last name<input value={profile.last_name} onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-[#e4eae1] px-3 text-sm outline-none focus:border-[#9bb990]" /></label><label className="block text-xs font-semibold text-[#6d7a6e]">Email address<input value={profile.email} disabled className="mt-1.5 h-11 w-full rounded-xl border border-[#edf0eb] bg-[#f7f8f5] px-3 text-sm text-[#99a399]" /><span className="mt-1 block text-[10px] text-[#9aa49a]">Email cannot be changed here.</span></label><button className="mt-2 rounded-full bg-[#294332] px-5 py-3 text-xs font-bold text-white">Save profile</button></div>}</form><Link to="/orders" className="flex items-center justify-between rounded-[18px] border border-[#e8ede5] bg-white p-4 text-sm font-bold text-[#425545]"><span className="flex items-center gap-3"><PackageCheck size={18} className="text-[#6b8f5d]" /> My orders</span><ChevronRight size={17} /></Link><Link to="/wishlist" className="flex items-center justify-between rounded-[18px] border border-[#e8ede5] bg-white p-4 text-sm font-bold text-[#425545]"><span className="flex items-center gap-3"><Heart size={18} className="text-[#c76f69]" /> Saved wishlist</span><ChevronRight size={17} /></Link></div>
      <div className="rounded-[22px] border border-[#e8ede5] bg-white p-5 sm:p-6"><h2 className="font-display text-lg font-extrabold text-[#304334]">Delivery addresses</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{addresses.map((a) => <div key={a.id} className="rounded-xl border border-[#e8ede5] p-4"><div className="flex items-start justify-between"><p className="text-xs font-extrabold text-[#3b4e3e]">{a.full_name}{a.is_default && <span className="ml-2 rounded-full bg-[#edf4e9] px-2 py-1 text-[9px] text-[#5b8051]">DEFAULT</span>}</p><div className="flex gap-1"><button onClick={() => editAddress(a)} aria-label="Edit address" className="grid size-7 place-items-center rounded-full text-[#839083] hover:bg-[#f0f4ed]"><Pencil size={13} /></button><button onClick={() => deleteAddress(a.id)} aria-label="Delete address" className="grid size-7 place-items-center rounded-full text-[#a37b77] hover:bg-[#fff1ef]"><Trash2 size={13} /></button></div></div><p className="mt-2 text-xs leading-5 text-[#7c897d]">{a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />{a.city}, {a.state} {a.postal_code}<br />{a.phone}</p></div>)}{!addresses.length && <p className="text-xs text-[#879387]">No saved addresses yet. Add one below.</p>}</div><form onSubmit={saveAddress} className="mt-6 border-t border-[#edf0eb] pt-5"><h3 className="text-sm font-extrabold text-[#425545]">{editing ? "Edit address" : "Add an address"}</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{fields.map(([key,label]) => <input key={key} value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required={key !== "line2"} placeholder={label} className={`h-10 rounded-xl border border-[#e4eae1] px-3 text-xs outline-none focus:border-[#9bb990] ${["line1","line2"].includes(key) ? "sm:col-span-2" : ""}`} />)}</div><label className="mt-3 flex items-center gap-2 text-xs text-[#718073]"><input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} className="accent-[#50754a]" /> Make this my default address</label><div className="mt-4 flex gap-2"><button disabled={busy} className="rounded-full bg-[#294332] px-5 py-2.5 text-xs font-bold text-white">{busy ? "Saving..." : "Save address"}</button>{editing && <button type="button" onClick={() => setEditing(null)} className="rounded-full bg-[#edf2ea] px-5 py-2.5 text-xs font-bold text-[#607261]">Cancel</button>}</div></form></div>
    </div>
  </main>;
}

function Wishlist() {
  const { wish, refreshCounts, notify } = useStore();
  const remove = async (item) => { try { await api.delete(`/wishlist/?item_id=${item.id}`); await refreshCounts(); notify("Removed from wishlist."); } catch (error) { notify(errorMessage(error)); } };
  return <main><PageIntro eyebrow="The things you love" title="Your wishlist." text="Keep a little list of your next good find." /><div className="mx-auto max-w-[1400px] px-5 py-10 sm:px-10 lg:px-12">{wish.length ? <><div className="mb-5 flex items-center justify-between"><p className="text-xs text-[#809080]">{wish.length} saved find{wish.length === 1 ? "" : "s"}</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">{wish.map((item) => <div key={item.id} className="relative"><ProductCard product={item.product} /><button onClick={() => remove(item)} className="absolute bottom-4 right-14 rounded-full bg-white p-2 text-[#a36c69] shadow" aria-label="Remove from wishlist"><Trash2 size={14} /></button></div>)}</div></> : <EmptyState icon={Heart} title="A place for your future favourites." text="Tap the little heart on anything you love to save it here." action={<Link to="/shop" className="rounded-full bg-[#294332] px-5 py-3 text-xs font-bold text-white">Browse good finds</Link>} />}</div></main>;
}

function Exchange() {
  const { user, notify } = useStore();
  const [form, setForm] = useState({ product_type: "mobile", product_name: "", condition: "good", description: "" });
  const [photos, setPhotos] = useState([]);
  const [photoError, setPhotoError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const photoInput = useRef(null);
  const previewUrls = useRef(new Set());
  useEffect(() => () => previewUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);
  const addPhotos = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        setPhotoError("Each photo must be 5 MB or smaller.");
        return;
      }
      const extension = file.name.split(".").pop().toLowerCase();
      if (!["jpg", "jpeg", "png", "webp"].includes(extension) || (file.type && !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
        setPhotoError("Please upload JPG/PNG only");
        return;
      }
    }
    if (photos.length + files.length > 3) {
      setPhotoError("You can upload up to 3 photos.");
      return;
    }
    const additions = files.map((file) => {
      const preview = URL.createObjectURL(file);
      previewUrls.current.add(preview);
      return { file, preview };
    });
    setPhotos((current) => [...current, ...additions]);
    setPhotoError("");
  };
  const removePhoto = (index) => {
    const removed = photos[index];
    URL.revokeObjectURL(removed.preview);
    previewUrls.current.delete(removed.preview);
    setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index));
    setPhotoError("");
  };
  const clearPhotos = () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
    setPhotos([]);
  };
  const submit = async (e) => {
    e.preventDefault();
    if (!user) { notify("Sign in to request an exchange estimate."); return; }
    setBusy(true);
    const data = new FormData();
    Object.entries(form).forEach(([key,value]) => data.append(key,value));
    photos.forEach(({ file }) => data.append("photos_upload", file));
    try { const { data: response } = await api.post("/exchange/estimate/", data); setResult(response); clearPhotos(); notify("Your exchange request is in."); }
    catch (error) { notify(errorMessage(error)); }
    finally { setBusy(false); }
  };
  return <main><section className="relative overflow-hidden bg-[#edf3e9]"><div className="mx-auto grid max-w-[1400px] gap-8 px-5 py-12 sm:px-10 sm:py-16 lg:grid-cols-[1.05fr_.95fr] lg:px-12"><div className="self-center"><p className="text-[11px] font-extrabold uppercase tracking-[.2em] text-[#6d8d59]">Exchange zone</p><h1 className="mt-3 font-display text-4xl font-extrabold leading-[1.08] tracking-[-1.8px] text-[#203629] sm:text-6xl">Your old tech<br /><span className="text-[#72975d]">still has a next.</span></h1><p className="mt-5 max-w-lg text-sm leading-7 text-[#6b7b6d]">Trade in your phone or laptop and give it a fresh start. Tell us a little about it and get an instant estimate.</p><div className="mt-6 flex items-center gap-4 text-xs font-semibold text-[#526b53]"><span className="flex items-center gap-1.5"><Check size={15} /> Fair estimates</span><span className="flex items-center gap-1.5"><Check size={15} /> Easy process</span></div></div><div className="overflow-hidden rounded-[24px]"><img src="/images/products/macbook-air-m1.jpg" alt="Laptop ready for a new owner" className="h-[300px] w-full object-cover sm:h-[400px]" /></div></div></section>
    <div className="mx-auto grid max-w-[1150px] gap-7 px-5 py-10 sm:px-10 lg:grid-cols-[1fr_.85fr] lg:px-12"><form onSubmit={submit} className="rounded-[22px] border border-[#e8ede5] bg-white p-5 sm:p-7"><h2 className="font-display text-xl font-extrabold text-[#304334]">Tell us about your device</h2><p className="mt-1 text-xs text-[#819081]">The more detail you share, the better we can help.</p><div className="mt-5 space-y-4"><label className="block text-xs font-bold text-[#627263]">What are you trading in?<select value={form.product_type} onChange={(e) => setForm({ ...form, product_type: e.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-[#e4eae1] bg-white px-3 text-sm font-normal"><option value="mobile">Mobile phone</option><option value="laptop">Laptop</option></select></label><label className="block text-xs font-bold text-[#627263]">Make & model<input required value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} placeholder="e.g. Samsung Galaxy S21" className="mt-1.5 h-11 w-full rounded-xl border border-[#e4eae1] px-3 text-sm font-normal outline-none focus:border-[#9bb990]" /></label><label className="block text-xs font-bold text-[#627263]">Condition<select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-[#e4eae1] bg-white px-3 text-sm font-normal"><option value="like_new">Like new — barely used</option><option value="good">Good — works well, light wear</option><option value="average">Average — visible wear</option></select></label><label className="block text-xs font-bold text-[#627263]">Anything else we should know?<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Share details about the battery, accessories, or scratches..." className="mt-1.5 w-full rounded-xl border border-[#e4eae1] p-3 text-sm font-normal outline-none focus:border-[#9bb990]" /></label>
      <div
        role="group"
        aria-label="Device photos"
        className={`rounded-2xl border-2 border-dashed p-4 transition-colors ${isDragging ? "border-[#5d9850] bg-[#edf7e9]" : "border-[#cbd9c5] bg-[#f6f9f4] hover:border-[#8eaf80]"}`}
        onClick={(event) => {
          if (!event.target.closest("[data-photo-control]")) photoInput.current?.click();
        }}
        onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false);
        }}
        onDrop={(event) => { event.preventDefault(); setIsDragging(false); addPhotos(event.dataTransfer.files); }}
      >
        <input data-photo-control ref={photoInput} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple onChange={(event) => { addPhotos(event.target.files); event.target.value = ""; }} className="hidden" />
        {photos.length < 3 && <button data-photo-control type="button" onClick={() => photoInput.current?.click()} className="flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-xl px-2 py-3 text-center text-xs text-[#67815f]">
          <span className="upload-icon-bob grid size-10 place-items-center rounded-full bg-white text-[#5d8a50] shadow-sm"><Upload size={20} /></span>
          <span><b className="text-sm">Click to upload or Drag &amp; Drop</b><span className="mt-1 block">Front, back or side · JPG, PNG, WebP · Up to 5 MB each</span></span>
        </button>}
        {photos.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {photos.map(({ file, preview }, index) => <div data-photo-control key={`${file.name}-${file.lastModified}-${index}`} className="flex min-w-0 items-center gap-2 rounded-xl border border-[#e2eade] bg-white p-2">
            <img src={preview} alt={`${["Front", "Back", "Side"][index]} view preview`} className="size-12 shrink-0 rounded-lg object-cover" />
            <div className="min-w-0 flex-1"><p className="text-[10px] font-bold text-[#526653]">{["Front", "Back", "Side"][index]} view</p><p className="truncate text-[10px] text-[#6f7d70]" title={file.name}>{file.name}</p><p className="text-[10px] text-[#9aa49a]">{(file.size / (1024 * 1024)).toFixed(2)} MB</p></div>
            <button type="button" onClick={() => removePhoto(index)} aria-label={`Remove ${file.name}`} className="grid size-7 shrink-0 place-items-center rounded-full text-[#718071] hover:bg-[#f0f4ed] hover:text-[#b85850]"><X size={15} /></button>
          </div>)}
        </div>}
      </div>
      {photoError && <p role="alert" className="text-xs font-semibold text-[#b34d45]">{photoError}</p>}
      <button disabled={busy} className="button-primary flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold text-white disabled:opacity-60">{busy ? "Getting your estimate..." : "Get my estimate"} <ArrowRight size={16} /></button><p className="text-center text-[10px] text-[#9aa49a]">You'll need an account to submit an exchange request.</p></div></form>
      <div className="space-y-4">{result ? <div className="rounded-[22px] bg-[#294332] p-6 text-white"><span className="grid size-11 place-items-center rounded-xl bg-white/10 text-[#c6e1b4]"><Check size={22} /></span><p className="mt-5 text-[10px] font-bold uppercase tracking-[.18em] text-[#b9d0ad]">Estimate received</p><p className="mt-2 font-display text-4xl font-extrabold">{money(result.estimate)}</p><p className="mt-3 text-xs leading-6 text-[#c3d0c3]">This is an indicative estimate for your {result.product_name}. Our team will review your submission and follow up with you.</p><p className="mt-5 text-xs text-[#a9c39d]">Request status: {result.status}</p><button onClick={() => setResult(null)} className="mt-5 text-xs font-bold underline">Submit another device</button></div> : <div className="rounded-[22px] bg-[#294332] p-6 text-white"><span className="grid size-11 place-items-center rounded-xl bg-white/10 text-[#c6e1b4]"><HeartHandshake size={22} /></span><h3 className="mt-5 font-display text-xl font-extrabold">An easy next chapter</h3><div className="mt-5 space-y-4">{[["Tell us about it","Share your device details and condition."],["Get your estimate","See an indicative trade-in value straight away."],["We take it from here","Our team reviews your request and gets in touch."]].map(([title,copy],i)=><div key={title} className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold text-[#b9d0ad]">{i+1}</span><div><p className="text-sm font-bold">{title}</p><p className="mt-1 text-xs leading-5 text-[#bbcabd]">{copy}</p></div></div>)}</div></div>}<div className="rounded-[22px] border border-[#e8ede5] bg-white p-5"><h3 className="font-display font-extrabold text-[#344737]">Why exchange with us?</h3><p className="mt-2 text-xs leading-6 text-[#748175]">Keep useful devices in circulation, spend less on your next upgrade and help us make room for a little less e-waste.</p></div></div></div>
  </main>;
}

function About() {
  const stats = [["5,000+", "products given a new home"], ["3", "thoughtful categories"], ["6 months", "warranty on tech"], ["One planet", "worth looking after"]];
  const team = [
    ["/images/banners/customer-2.jpg", "Arjun Menon", "Founder & Chief Optimist"],
    ["/images/banners/customer-1.jpg", "Meera Nair", "Head of Quality"],
    ["/images/banners/team-karthik.jpg", "Karthik Rao", "Customer Experience"],
  ];
  return <main>
    <PageIntro eyebrow="A little about us" title="Good things deserve another go." text="ReNewKart is a home for quality-checked tech and books that still have plenty of life left in them." />
    <section className="mx-auto grid max-w-[1300px] gap-8 px-5 py-12 sm:px-10 lg:grid-cols-2 lg:items-center lg:px-12 lg:py-16">
      <div><p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#71905c]">Our story</p><h2 className="mt-3 font-display text-3xl font-extrabold leading-tight tracking-[-1px] text-[#203629] sm:text-4xl">New doesn't always mean better.</h2><p className="mt-4 text-sm leading-7 text-[#6c7a6d]">We started ReNewKart with a simple thought: why should something useful be set aside just because someone is ready for an upgrade? A perfectly good phone, laptop or book still has a lot to give.</p><p className="mt-3 text-sm leading-7 text-[#6c7a6d]">So we built a place where useful things get a proper second look. We inspect, clean and honestly grade every item—then pair it with someone who'll love it next.</p><p className="mt-5 font-display font-extrabold text-[#547c4b]">Old things, new life.</p></div>
      <div className="overflow-hidden rounded-[26px]"><img src="/images/banners/about-team.jpg" alt="The ReNewKart team" className="h-[320px] w-full object-cover sm:h-[390px]" /></div>
    </section>
    <section className="bg-[#294332]"><div className="mx-auto max-w-[1300px] px-5 py-11 sm:px-10 sm:py-14 lg:px-12"><p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#b8d2aa]">The little difference we're making</p><div className="mt-7 grid grid-cols-2 gap-6 sm:grid-cols-4">{stats.map(([value, label]) => <div key={label} className="border-t border-white/20 pt-4"><p className="font-display text-3xl font-extrabold text-white sm:text-4xl">{value}</p><p className="mt-2 text-xs leading-5 text-[#bdcbbf]">{label}</p></div>)}</div></div></section>
    <section className="mx-auto max-w-[1300px] px-5 py-12 sm:px-10 lg:px-12 lg:py-16"><SectionHeading eyebrow="The people behind the second chances" title="A small team with a big soft spot for good things." /><div className="grid gap-4 sm:grid-cols-3">{team.map(([image, name, job]) => <div key={name} className="overflow-hidden rounded-[22px] border border-[#e8ede5] bg-white"><img src={image} alt={name} className="h-64 w-full object-cover" /><div className="p-5"><h3 className="font-display font-extrabold text-[#344737]">{name}</h3><p className="mt-1 text-xs text-[#879387]">{job}</p></div></div>)}</div></section>
    <section className="mx-auto max-w-[1100px] px-5 pb-10 sm:px-10 lg:px-12"><div className="rounded-[24px] bg-[#edf3e9] p-7 sm:p-10"><div className="grid gap-6 sm:grid-cols-2"><div><p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#71905c]">Our mission</p><h2 className="mt-2 font-display text-2xl font-extrabold text-[#24392b]">Useful things, used well.</h2></div><p className="text-sm leading-7 text-[#68796b]">Make quality more accessible, make buying second-hand feel first-class, and help good products stay in use for longer. Every thoughtful purchase is a small vote for a less wasteful future.</p></div></div></section>
  </main>;
}

function Contact() {
  const { notify } = useStore();
  const [values, setValues] = useState({ name: "", email: "", subject: "", message: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await api.post("/contact/", values); setValues({ name: "", email: "", subject: "", message: "" }); notify("Thanks for reaching out. Our team will be in touch."); }
    catch (error) { notify(errorMessage(error)); }
    finally { setBusy(false); }
  };
  return <main><PageIntro eyebrow="We're here to help" title="Let's talk." text="Questions about a find, an order, or what happens next? Drop us a note." /><div className="mx-auto grid max-w-[1100px] gap-7 px-5 py-10 sm:px-10 lg:grid-cols-[.8fr_1.2fr] lg:px-12"><div className="rounded-[22px] bg-[#294332] p-6 text-white"><h2 className="font-display text-xl font-extrabold">A real person, just a message away.</h2><p className="mt-2 text-sm leading-6 text-[#c2d0c3]">We usually reply within one business day.</p><a href="mailto:hello@renewkart.in" className="mt-7 flex items-center gap-3 rounded-xl bg-white/10 p-4 text-sm"><Mail size={18} className="text-[#c2ddaF]" /> hello@renewkart.in</a><p className="mt-4 flex items-center gap-3 rounded-xl bg-white/10 p-4 text-sm"><Clock3 size={18} className="text-[#c2ddaf]" /> Mon–Sat · 9am–6pm IST</p><Link to="/faq" className="mt-7 inline-flex items-center gap-2 text-xs font-bold text-[#c6dfb9]">Browse common questions <ArrowRight size={14} /></Link></div><form onSubmit={submit} className="rounded-[22px] border border-[#e8ede5] bg-white p-5 sm:p-7"><h2 className="font-display text-xl font-extrabold text-[#304334]">Send us a message</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{[["name","Your name"],["email","Email address"],["subject","Subject"]].map(([key,label]) => <label key={key} className={`text-xs font-bold text-[#657467] ${key === "subject" ? "sm:col-span-2" : ""}`}>{label}<input required type={key === "email" ? "email" : "text"} value={values[key]} onChange={(e) => setValues({ ...values, [key]: e.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-[#e4eae1] px-3 text-sm font-normal outline-none focus:border-[#9bb990]" /></label>)}<label className="text-xs font-bold text-[#657467] sm:col-span-2">How can we help?<textarea required minLength={10} rows={5} value={values.message} onChange={(e) => setValues({ ...values, message: e.target.value })} className="mt-1.5 w-full rounded-xl border border-[#e4eae1] p-3 text-sm font-normal outline-none focus:border-[#9bb990]" /></label></div><button disabled={busy} className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-[#294332] px-6 text-xs font-bold text-white disabled:opacity-60">{busy ? "Sending..." : "Send message"} <ArrowRight size={15} /></button></form></div></main>;
}

const faqItems = [
  ["How do you check refurbished products?", "Every device is inspected for core functions, cleaned and graded by condition. Product pages include the grade and warranty details so you know what to expect before buying."],
  ["What do the condition grades mean?", "Like New means minimal signs of use; Good means light cosmetic wear while fully functional; Average means more visible wear, clearly reflected in the product photos and price."],
  ["Can I return an item?", "Eligible products can be returned within 7 days of delivery if they are in the condition described. Please visit our Warranty & Returns page for the full policy."],
  ["How does the exchange estimate work?", "Tell us your device type and condition to receive an indicative estimate. Our team reviews the details and follows up to confirm the final offer and collection."],
  ["Do refurbished devices include a warranty?", "Most refurbished mobiles and laptops include a 6-month ReNewKart warranty. The exact warranty is shown on each product page. Books have a 7-day quality return window."],
  ["How can I track my order?", "Sign in and open My Orders to see its current status—from pending and confirmed to shipped and delivered."],
  ["Which payment methods are available?", "You can pay using Cash on Delivery or Razorpay (UPI, cards and net banking) when the store has been configured with Razorpay test credentials."],
];
function Faq() {
  const [open, setOpen] = useState(0);
  return <main><PageIntro eyebrow="The usual questions" title="A few helpful answers." text="If we missed something, our team is only a message away." /><div className="mx-auto max-w-[850px] px-5 py-10 sm:px-10"><div className="space-y-3">{faqItems.map(([question, answer], i) => <section key={question} className="overflow-hidden rounded-2xl border border-[#e7ebe4] bg-white"><button className="flex w-full items-center justify-between gap-4 p-5 text-left" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}><span className="font-display text-sm font-extrabold text-[#354838]">{question}</span><ChevronDown size={17} className={`shrink-0 text-[#78916d] transition ${open === i ? "rotate-180" : ""}`} /></button>{open === i && <p className="px-5 pb-5 text-sm leading-6 text-[#718073]">{answer}</p>}</section>)}</div><p className="mt-7 text-center text-sm text-[#849084]">Still wondering? <Link to="/contact" className="font-bold text-[#567c4c] underline">Talk to us</Link>.</p></div></main>;
}

function Warranty() {
  return <main><PageIntro eyebrow="The promise behind every find" title="Warranty & returns." text="Second-hand shouldn't mean second-rate support. Here's what you can count on." /><div className="mx-auto max-w-[950px] space-y-5 px-5 py-10 sm:px-10">
    {[["A 6-month warranty on tech","Refurbished mobiles and laptops include a limited 6-month ReNewKart warranty covering eligible functional defects. The product page shows the exact coverage for each item. The warranty does not cover accidental damage, liquid exposure, or normal wear and tear."],["A 7-day return window","If your item isn't as described, contact us within 7 days of delivery. Keep the product, packaging and included accessories together while our team helps arrange the return. Refunds are issued to the original payment method; COD refunds are coordinated by our support team."],["How to request help","Email hello@renewkart.in with your order number, a short description of the issue and photos where relevant. We aim to reply within one business day."],["A note on pre-loved books","Books are quality checked before dispatch. If a copy arrives damaged or materially different from its listing, let us know within 7 days so we can make it right."]].map(([title, copy], i) => <section key={title} className="flex gap-4 rounded-[20px] border border-[#e8ede5] bg-white p-5 sm:p-6"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#eaf2e5] text-[#608652]">{i === 0 ? <ShieldCheck size={19} /> : i === 1 ? <PackageCheck size={19} /> : i === 2 ? <Mail size={19} /> : <BookOpen size={19} />}</span><div><h2 className="font-display font-extrabold text-[#344737]">{title}</h2><p className="mt-2 text-sm leading-6 text-[#718073]">{copy}</p></div></section>)}
    <div className="rounded-[20px] bg-[#f0f4ed] p-5 text-xs leading-6 text-[#738074]">This summary is provided for clarity. The warranty and return terms presented with the product and at checkout govern your purchase. <Link to="/contact" className="font-bold text-[#54794c] underline">Contact support</Link> with any questions.</div>
  </div></main>;
}

function AuthPage({ mode }) {
  const isSignup = mode === "signup";
  const [values, setValues] = useState({ first_name: "", last_name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const { signIn, notify } = useStore();
  const navigate = useNavigate();
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await signIn(isSignup ? "/auth/register/" : "/auth/login/", values); notify(isSignup ? "Your ReNewKart account is ready." : "Welcome back."); navigate("/"); }
    catch (error) { notify(errorMessage(error)); }
    finally { setBusy(false); }
  };
  return <main className="mx-auto grid min-h-[580px] max-w-[1100px] items-center gap-8 px-5 py-10 sm:px-10 lg:grid-cols-2 lg:px-12">
    <div className="hidden overflow-hidden rounded-[26px] bg-[#eaf1e6] lg:block"><img src={imageFallback} alt="A well-loved book" className="h-[510px] w-full object-cover opacity-80 mix-blend-multiply" /></div>
    <div className="mx-auto w-full max-w-[430px]"><Link to="/" className="inline-flex items-center gap-2 text-xs font-bold text-[#718073]"><ArrowLeft size={14} /> Back to the store</Link><div className="mt-6 flex justify-center"><Logo /></div><p className="mt-7 text-[11px] font-extrabold uppercase tracking-[.18em] text-[#71905c]">{isSignup ? "A fresh start" : "Good to see you again"}</p><h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-1px] text-[#203629]">{isSignup ? "Join the second life." : "Welcome back."}</h1><p className="mt-2 text-sm text-[#7b887c]">{isSignup ? "Create an account to find, save and track your good finds." : "Sign in to pick up where you left off."}</p>
      <form onSubmit={submit} className="mt-7 space-y-3">{isSignup && <div className="grid grid-cols-2 gap-3"><input required value={values.first_name} onChange={(e) => setValues({ ...values, first_name: e.target.value })} placeholder="First name" className="h-12 rounded-xl border border-[#e3e9e1] bg-white px-3 text-sm outline-none focus:border-[#9bb990]" /><input value={values.last_name} onChange={(e) => setValues({ ...values, last_name: e.target.value })} placeholder="Last name" className="h-12 rounded-xl border border-[#e3e9e1] bg-white px-3 text-sm outline-none focus:border-[#9bb990]" /></div>}<input type="email" autoComplete="email" required value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} placeholder="Email address" className="h-12 w-full rounded-xl border border-[#e3e9e1] bg-white px-4 text-sm outline-none focus:border-[#9bb990]" /><input type="password" autoComplete={isSignup ? "new-password" : "current-password"} minLength={isSignup ? 8 : undefined} required value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} placeholder="Password" className="h-12 w-full rounded-xl border border-[#e3e9e1] bg-white px-4 text-sm outline-none focus:border-[#9bb990]" />{!isSignup && <div className="text-right"><Link to="/forgot-password" className="text-xs font-bold text-[#638256]">Forgot password?</Link></div>}<button disabled={busy} className="button-primary flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold text-white disabled:opacity-60">{busy ? "One moment..." : isSignup ? "Create my account" : "Sign in"} <ArrowRight size={16} /></button></form>
      <p className="mt-5 text-center text-xs text-[#899489]">{isSignup ? "Already have an account?" : "New to ReNewKart?"} <Link to={isSignup ? "/login" : "/signup"} className="font-bold text-[#557d4c] underline">{isSignup ? "Sign in" : "Create an account"}</Link></p>
      <p className="mt-5 flex items-center justify-center gap-1.5 text-[10px] text-[#a0a9a0]"><LockKeyhole size={12} /> Your details stay safe and secure.</p>
    </div>
  </main>;
}

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const { notify } = useStore();
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.post("/auth/forgot-password/", { email }); setSent(true); }
    catch (error) { notify(errorMessage(error)); }
    finally { setBusy(false); }
  };
  return <main className="mx-auto flex min-h-[500px] max-w-[600px] items-center px-5 py-12"><div className="w-full rounded-[24px] border border-[#e8ede5] bg-white p-6 sm:p-9"><span className="grid size-12 place-items-center rounded-2xl bg-[#e9f2e3] text-[#608652]"><Mail size={21} /></span><h1 className="mt-5 font-display text-2xl font-extrabold text-[#304334]">Forgot your password?</h1><p className="mt-2 text-sm leading-6 text-[#79867a]">Enter your email and, if there's an account, we'll send instructions to reset your password.</p>{sent ? <p className="mt-5 rounded-xl bg-[#eef5e9] p-4 text-sm text-[#54784c]">If that email is registered, reset instructions have been sent. Check the email configured for this store.</p> : <form onSubmit={submit} className="mt-5"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" className="h-12 w-full rounded-xl border border-[#e3e9e1] px-4 text-sm outline-none focus:border-[#9bb990]" /><button disabled={busy} className="mt-3 h-12 w-full rounded-full bg-[#294332] text-sm font-bold text-white disabled:opacity-60">{busy ? "Sending..." : "Send reset instructions"}</button></form>}<Link to="/login" className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-[#5b8051]"><ArrowLeft size={14} /> Back to sign in</Link></div></main>;
}

function ResetPassword() {
  const { uid, token } = useParams();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const { notify } = useStore();
  const navigate = useNavigate();
  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirmation) { notify("The passwords do not match."); return; }
    setBusy(true);
    try { await api.post("/auth/reset-password/", { uid, token, password }); setDone(true); }
    catch (error) { notify(errorMessage(error)); }
    finally { setBusy(false); }
  };
  return <main className="mx-auto flex min-h-[500px] max-w-[600px] items-center px-5 py-12"><div className="w-full rounded-[24px] border border-[#e8ede5] bg-white p-6 sm:p-9"><span className="grid size-12 place-items-center rounded-2xl bg-[#e9f2e3] text-[#608652]"><LockKeyhole size={21} /></span><h1 className="mt-5 font-display text-2xl font-extrabold text-[#304334]">Choose a new password.</h1>{done ? <><p className="mt-3 text-sm text-[#647565]">Your password has been updated. Sign in with the new one.</p><button onClick={() => navigate("/login")} className="mt-5 rounded-full bg-[#294332] px-5 py-3 text-xs font-bold text-white">Go to sign in</button></> : <form onSubmit={submit} className="mt-5 space-y-3"><p className="text-sm leading-6 text-[#79867a]">Choose a strong password you haven't used before.</p><input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" className="h-12 w-full rounded-xl border border-[#e3e9e1] px-4 text-sm outline-none focus:border-[#9bb990]" /><input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="Confirm new password" className="h-12 w-full rounded-xl border border-[#e3e9e1] px-4 text-sm outline-none focus:border-[#9bb990]" /><button disabled={busy} className="h-12 w-full rounded-full bg-[#294332] text-sm font-bold text-white disabled:opacity-60">{busy ? "Updating..." : "Update password"}</button></form>}</div></main>;
}

function Admin() {
  const { user, notify } = useStore();
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [productForm, setProductForm] = useState({ name: "", slug: "", category: "", brand: "", description: "", price: "", old_price: "", image: "", stock: 1, condition: "good", warranty: "6-month ReNewKart warranty", images: [] });
  const [categoryForm, setCategoryForm] = useState({ name: "", slug: "", description: "", image: "" });
  const [couponForm, setCouponForm] = useState({ code: "", discount_percent: 10, active: true });
  const [imageFile, setImageFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    try {
      const [s,p,c,o,u,cp] = await Promise.all([
        api.get("/admin/stats/"), api.get("/admin/products/"), api.get("/admin/categories/"),
        api.get("/admin/orders/"), api.get("/admin/users/"), api.get("/admin/coupons/"),
      ]);
      setStats(s.data); setProducts(p.data.results || p.data); setCategories(c.data.results || c.data);
      setOrders(o.data.results || o.data); setUsers(u.data.results || u.data); setCoupons(cp.data.results || cp.data);
    } catch (error) { notify(errorMessage(error)); }
  }, [notify]);
  useEffect(() => { if (user?.is_staff) reload(); }, [user, reload]);
  if (!user) return <main><PageIntro eyebrow="The ReNewKart team" title="Admin sign in." /><div className="mx-auto max-w-xl px-5 py-10"><SignInPrompt /></div></main>;
  if (!user.is_staff) return <main><PageIntro eyebrow="Restricted area" title="Admin access only." text="This area is for authorised ReNewKart staff." /><div className="mx-auto max-w-xl px-5 py-10"><Link to="/" className="inline-flex items-center gap-2 rounded-full bg-[#294332] px-5 py-3 text-xs font-bold text-white"><ArrowLeft size={14} /> Back to the store</Link></div></main>;
  const resetProductForm = () => { setEditingProduct(null); setProductForm({ name: "", slug: "", category: categories[0]?.id || "", brand: "", description: "", price: "", old_price: "", image: "", stock: 1, condition: "good", warranty: "6-month ReNewKart warranty", images: [] }); setImageFile(null); };
  const editProduct = (product) => { setEditingProduct(product.id); setProductForm({ ...product, category: product.category, old_price: product.old_price || "", images: product.images || [] }); setImageFile(null); setTab("products"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const saveProduct = async (e) => {
    e.preventDefault(); setBusy(true);
    const data = new FormData();
    Object.entries(productForm).forEach(([key,value]) => data.append(key, key === "images" ? JSON.stringify(value) : value));
    if (imageFile) data.append("image_file", imageFile);
    try {
      if (editingProduct) await api.patch(`/admin/products/${editingProduct}/`, data);
      else await api.post("/admin/products/", data);
      notify(editingProduct ? "Product updated." : "Product added.");
      resetProductForm(); await reload();
    } catch (error) { notify(errorMessage(error)); }
    finally { setBusy(false); }
  };
  const deleteProduct = async (product) => {
    if (!window.confirm(`Remove "${product.name}" from the catalogue?`)) return;
    try { await api.delete(`/admin/products/${product.id}/`); notify("Product removed."); await reload(); }
    catch (error) { notify(errorMessage(error)); }
  };
  const saveCategory = async (e) => {
    e.preventDefault();
    try {
      if (editingCategory) await api.patch(`/admin/categories/${editingCategory}/`, categoryForm);
      else await api.post("/admin/categories/", categoryForm);
      setCategoryForm({ name: "", slug: "", description: "", image: "" });
      notify(editingCategory ? "Category updated." : "Category added.");
      setEditingCategory(null);
      await reload();
    } catch (error) { notify(errorMessage(error)); }
  };
  const editCategory = (category) => {
    setEditingCategory(category.id);
    setCategoryForm({ name: category.name, slug: category.slug, description: category.description || "", image: category.image || "" });
  };
  const deleteCategory = async (category) => {
    if (!window.confirm(`Delete category "${category.name}"?`)) return;
    try { await api.delete(`/admin/categories/${category.id}/`); notify("Category removed."); await reload(); }
    catch (error) { notify(errorMessage(error)); }
  };
  const updateOrder = async (order, newStatus) => {
    try { await api.patch(`/admin/orders/${order.order_number}/`, { status: newStatus }); notify("Order status updated."); await reload(); }
    catch (error) { notify(errorMessage(error)); }
  };
  const toggleUser = async (person) => {
    try { await api.patch(`/admin/users/${person.id}/`, { is_active: !person.is_active }); notify(person.is_active ? "Customer blocked." : "Customer unblocked."); await reload(); }
    catch (error) { notify(errorMessage(error)); }
  };
  const saveCoupon = async (e) => {
    e.preventDefault();
    try { await api.post("/admin/coupons/", { ...couponForm, code: couponForm.code.toUpperCase() }); setCouponForm({ code: "", discount_percent: 10, active: true }); notify("Coupon created."); await reload(); }
    catch (error) { notify(errorMessage(error)); }
  };
  const deleteCoupon = async (coupon) => {
    try { await api.delete(`/admin/coupons/${coupon.id}/`); notify("Coupon deleted."); await reload(); }
    catch (error) { notify(errorMessage(error)); }
  };
  const tabs = [["overview", "Overview", LayoutDashboard], ["products", "Products", PackageCheck], ["categories", "Categories", BookOpen], ["orders", "Orders", ShoppingBag], ["customers", "Customers", UserRound], ["coupons", "Coupons", Sparkles]];
  return <main className="mx-auto max-w-[1450px] px-4 py-8 sm:px-8 lg:px-10">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#71905c]">ReNewKart operations</p><h1 className="mt-1 font-display text-3xl font-extrabold tracking-[-1px] text-[#203629]">Admin dashboard</h1></div><button onClick={reload} className="rounded-full border border-[#dfe7dd] bg-white px-4 py-2 text-xs font-bold text-[#5b705d]">Refresh data</button></div>
    <div className="mb-6 flex gap-2 overflow-x-auto pb-2">{tabs.map(([key,label,Icon]) => <button key={key} onClick={() => setTab(key)} className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold ${tab === key ? "bg-[#294332] text-white" : "border border-[#e6ebe3] bg-white text-[#677568]"}`}><Icon size={15} />{label}</button>)}</div>
    {tab === "overview" && (stats ? <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Total sales",money(stats.sales),ShoppingBag],["Orders",stats.orders,PackageCheck],["Products",stats.products,BookOpen],["Customers",stats.users,UserRound]].map(([label,value,Icon]) => <div key={label} className="rounded-[18px] border border-[#e8ede5] bg-white p-5"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-[#829083]">{label}</p><Icon size={17} className="text-[#78966b]" /></div><p className="mt-3 font-display text-2xl font-extrabold text-[#304334]">{value}</p></div>)}</div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_.8fr]"><div className="rounded-[20px] border border-[#e8ede5] bg-white p-5"><h2 className="font-display font-extrabold text-[#304334]">Sales & orders · last 6 months</h2><div className="mt-7 flex h-48 items-end gap-3 border-b border-l border-[#edf0eb] px-4">{stats.monthly.map((m) => { const max = Math.max(1, ...stats.monthly.map((item) => item.sales)); return <div key={`${m.month}-${m.orders}`} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="w-full max-w-12 rounded-t-lg bg-[#8eae7e] transition hover:bg-[#668d56]" style={{ height: `${Math.max(4, m.sales / max * 100)}%` }} title={`${money(m.sales)} · ${m.orders} orders`} /><span className="mb-[-21px] text-[10px] text-[#899589]">{m.month}</span></div>; })}</div><p className="mt-7 flex items-center gap-2 text-[10px] text-[#909a90]"><span className="size-2 rounded-sm bg-[#8eae7e]" /> Sales volume <span className="ml-auto">Low-stock items: <b className="text-[#a76d3e]">{stats.low_stock}</b></span></p></div>
      <div className="rounded-[20px] border border-[#e8ede5] bg-white p-5"><h2 className="font-display font-extrabold text-[#304334]">Recent orders</h2><div className="mt-4 space-y-3">{(stats.recent_orders || []).length ? stats.recent_orders.map((order) => <Link key={order.id} to={`/orders/${order.order_number}`} className="flex items-center justify-between gap-3 border-b border-[#edf0eb] pb-3"><div><p className="text-xs font-bold text-[#3d5040]">{order.order_number}</p><p className="mt-1 text-[10px] capitalize text-[#8a968b]">{order.status}</p></div><b className="text-xs">{money(order.total)}</b></Link>) : <p className="text-xs text-[#879387]">No orders yet.</p>}</div><button onClick={() => setTab("orders")} className="mt-4 text-xs font-bold text-[#5b8051]">View all orders →</button></div></div>
    </div> : <LoadingPage />)}
    {tab === "products" && <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]"><form onSubmit={saveProduct} className="h-fit rounded-[20px] border border-[#e8ede5] bg-white p-5"><div className="flex items-center justify-between"><h2 className="font-display font-extrabold text-[#304334]">{editingProduct ? "Edit product" : "Add a product"}</h2>{editingProduct && <button type="button" onClick={resetProductForm} className="text-xs font-bold text-[#68835e]">Cancel</button>}</div><div className="mt-4 grid gap-3 sm:grid-cols-2">{[["name","Product name"],["slug","URL slug"],["brand","Brand"],["price","Price ₹"],["old_price","Old price ₹"],["stock","Stock quantity"]].map(([key,label]) => <label key={key} className="text-[10px] font-bold text-[#728073]">{label}<input required={key !== "old_price"} type={["price","old_price","stock"].includes(key) ? "number" : "text"} min={["price","old_price","stock"].includes(key) ? "0" : undefined} step={["price","old_price"].includes(key) ? "0.01" : undefined} value={productForm[key] ?? ""} onChange={(e) => setProductForm({ ...productForm, [key]: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-[#e4eae1] px-3 text-xs font-normal outline-none focus:border-[#9bb990]" /></label>)}<label className="text-[10px] font-bold text-[#728073]">Category<select required value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-[#e4eae1] bg-white px-2 text-xs font-normal"><option value="">Choose category</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="text-[10px] font-bold text-[#728073]">Condition<select value={productForm.condition} onChange={(e) => setProductForm({ ...productForm, condition: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-[#e4eae1] bg-white px-2 text-xs font-normal"><option value="like_new">Like New</option><option value="good">Good</option><option value="average">Average</option></select></label><label className="text-[10px] font-bold text-[#728073] sm:col-span-2">Image URL<input value={productForm.image || ""} onChange={(e) => setProductForm({ ...productForm, image: e.target.value })} placeholder="https://..." className="mt-1 h-10 w-full rounded-xl border border-[#e4eae1] px-3 text-xs font-normal" /></label><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[#cbd9c5] p-3 text-[10px] font-bold text-[#66815f] sm:col-span-2"><Upload size={15} />{imageFile?.name || "Upload product image"}<input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="sr-only" /></label><label className="text-[10px] font-bold text-[#728073] sm:col-span-2">Description<textarea required rows={3} value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} className="mt-1 w-full rounded-xl border border-[#e4eae1] p-3 text-xs font-normal outline-none focus:border-[#9bb990]" /></label><label className="text-[10px] font-bold text-[#728073] sm:col-span-2">Warranty<input value={productForm.warranty || ""} onChange={(e) => setProductForm({ ...productForm, warranty: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-[#e4eae1] px-3 text-xs font-normal" /></label></div><button disabled={busy} className="mt-4 w-full rounded-full bg-[#294332] py-3 text-xs font-bold text-white disabled:opacity-60">{busy ? "Saving..." : editingProduct ? "Save changes" : "Add product"}</button></form>
      <div className="overflow-hidden rounded-[20px] border border-[#e8ede5] bg-white"><div className="border-b border-[#edf0eb] p-5"><h2 className="font-display font-extrabold text-[#304334]">Product inventory <span className="ml-1 text-xs font-medium text-[#899589]">({products.length})</span></h2></div><div className="max-h-[720px] overflow-auto">{products.map((p) => <div key={p.id} className="flex items-center gap-3 border-b border-[#edf0eb] p-3.5"><img src={localProductImage(p)} alt={p.name} onError={(event) => { event.currentTarget.src = imageFallback; }} className="size-12 rounded-xl object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-extrabold text-[#3b4e3e]">{p.name}</p><p className="mt-1 text-[10px] text-[#879387]">{p.category_name} · Stock: <b className={p.stock < 5 ? "text-[#b46e3b]" : ""}>{p.stock}</b> · {money(p.price)}</p></div><button onClick={() => editProduct(p)} aria-label="Edit product" className="grid size-8 place-items-center rounded-full text-[#738674] hover:bg-[#eff4ec]"><Pencil size={14} /></button><button onClick={() => deleteProduct(p)} aria-label="Delete product" className="grid size-8 place-items-center rounded-full text-[#a97570] hover:bg-[#fff1ef]"><Trash2 size={14} /></button></div>)}</div></div></div>}
    {tab === "categories" && <div className="grid gap-5 lg:grid-cols-2">
      <form onSubmit={saveCategory} className="h-fit rounded-[20px] border border-[#e8ede5] bg-white p-5">
        <h2 className="font-display font-extrabold text-[#304334]">{editingCategory ? "Edit category" : "Add a category"}</h2>
        <div className="mt-4 space-y-3">{[["name","Category name"],["slug","URL slug"],["description","Short description"],["image","Image URL"]].map(([key,label]) => <label key={key} className="block text-[10px] font-bold text-[#728073]">{label}<input required={key === "name" || key === "slug"} value={categoryForm[key]} onChange={(e) => setCategoryForm({ ...categoryForm, [key]: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-[#e4eae1] px-3 text-xs font-normal" /></label>)}</div>
        <div className="mt-4 flex gap-2"><button className="rounded-full bg-[#294332] px-5 py-3 text-xs font-bold text-white">{editingCategory ? "Save category" : "Create category"}</button>{editingCategory && <button type="button" onClick={() => { setEditingCategory(null); setCategoryForm({ name: "", slug: "", description: "", image: "" }); }} className="rounded-full bg-[#edf2ea] px-5 py-3 text-xs font-bold text-[#607261]">Cancel</button>}</div>
      </form>
      <div className="rounded-[20px] border border-[#e8ede5] bg-white p-5"><h2 className="font-display font-extrabold text-[#304334]">Manage categories</h2><div className="mt-4 space-y-3">{categories.map((c) => <div key={c.id} className="flex items-center gap-3 rounded-xl border border-[#edf0eb] p-3"><img src={localCategoryImage(c)} alt="" className="size-12 rounded-lg object-cover" /><div className="min-w-0 flex-1"><p className="text-sm font-bold text-[#415443]">{c.name}</p><p className="text-[10px] text-[#899589]">{c.slug}</p></div><button onClick={() => editCategory(c)} className="grid size-8 place-items-center rounded-full text-[#738674] hover:bg-[#eff4ec]" aria-label="Edit category"><Pencil size={14} /></button><button onClick={() => deleteCategory(c)} className="grid size-8 place-items-center rounded-full text-[#a97570] hover:bg-[#fff1ef]" aria-label="Delete category"><Trash2 size={14} /></button></div>)}</div></div>
    </div>}
    {tab === "orders" && <div className="overflow-x-auto rounded-[20px] border border-[#e8ede5] bg-white"><table className="w-full min-w-[800px] text-left"><thead className="bg-[#f3f6f1] text-[10px] uppercase tracking-wide text-[#849084]"><tr>{["Order","Customer","Date","Total","Payment","Status","Update status"].map((x) => <th key={x} className="px-4 py-3">{x}</th>)}</tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="border-t border-[#edf0eb] text-xs"><td className="px-4 py-3 font-bold text-[#405343]">{order.order_number}</td><td className="px-4 py-3 text-[#798579]">{order.shipping_address.full_name}</td><td className="px-4 py-3 text-[#798579]">{new Date(order.created_at).toLocaleDateString("en-IN")}</td><td className="px-4 py-3 font-bold">{money(order.total)}</td><td className="px-4 py-3 capitalize text-[#798579]">{order.payment_method} · {order.payment_status}</td><td className="px-4 py-3 capitalize">{order.status}</td><td className="px-4 py-3"><select value={order.status} onChange={(e) => updateOrder(order,e.target.value)} className="rounded-lg border border-[#e4eae1] bg-white px-2 py-1.5 text-[10px] capitalize"><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option></select></td></tr>)}</tbody></table>{!orders.length && <p className="p-8 text-center text-sm text-[#899589]">No orders yet.</p>}</div>}
    {tab === "customers" && <div className="overflow-x-auto rounded-[20px] border border-[#e8ede5] bg-white"><table className="w-full min-w-[650px] text-left"><thead className="bg-[#f3f6f1] text-[10px] uppercase tracking-wide text-[#849084]"><tr>{["Customer","Email","Joined","Status","Action"].map((x) => <th key={x} className="px-4 py-3">{x}</th>)}</tr></thead><tbody>{users.filter((u) => !u.is_staff).map((person) => <tr key={person.id} className="border-t border-[#edf0eb] text-xs"><td className="px-4 py-3 font-bold text-[#405343]">{person.first_name} {person.last_name}</td><td className="px-4 py-3 text-[#798579]">{person.email}</td><td className="px-4 py-3 text-[#798579]">{new Date(person.date_joined).toLocaleDateString("en-IN")}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${person.is_active ? "bg-[#edf4e9] text-[#55794c]" : "bg-[#fff0ee] text-[#a75c53]"}`}>{person.is_active ? "Active" : "Blocked"}</span></td><td className="px-4 py-3"><button onClick={() => toggleUser(person)} className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${person.is_active ? "bg-[#fff0ee] text-[#a75c53]" : "bg-[#edf4e9] text-[#55794c]"}`}>{person.is_active ? "Block" : "Unblock"}</button></td></tr>)}</tbody></table></div>}
    {tab === "coupons" && <div className="grid gap-5 lg:grid-cols-2"><form onSubmit={saveCoupon} className="h-fit rounded-[20px] border border-[#e8ede5] bg-white p-5"><h2 className="font-display font-extrabold text-[#304334]">Create a coupon</h2><p className="mt-1 text-xs text-[#829083]">Discounts are applied to the cart subtotal.</p><label className="mt-4 block text-[10px] font-bold text-[#728073]">Code<input required value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} placeholder="RENEW10" className="mt-1 h-10 w-full rounded-xl border border-[#e4eae1] px-3 text-xs font-normal uppercase" /></label><label className="mt-3 block text-[10px] font-bold text-[#728073]">Discount percentage<input required type="number" min="1" max="90" value={couponForm.discount_percent} onChange={(e) => setCouponForm({ ...couponForm, discount_percent: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-[#e4eae1] px-3 text-xs font-normal" /></label><button className="mt-4 rounded-full bg-[#294332] px-5 py-3 text-xs font-bold text-white">Create coupon</button></form><div className="rounded-[20px] border border-[#e8ede5] bg-white p-5"><h2 className="font-display font-extrabold text-[#304334]">Active codes</h2><div className="mt-4 space-y-3">{coupons.map((coupon) => <div key={coupon.id} className="flex items-center gap-3 rounded-xl border border-[#edf0eb] p-4"><span className="grid size-9 place-items-center rounded-lg bg-[#eaf2e5] text-[#628853]"><Sparkles size={16} /></span><div className="flex-1"><p className="font-display font-extrabold text-[#405343]">{coupon.code}</p><p className="mt-1 text-[10px] text-[#879387]">{coupon.discount_percent}% off · {coupon.active ? "Active" : "Inactive"}</p></div><button onClick={() => deleteCoupon(coupon)} aria-label="Delete coupon" className="grid size-8 place-items-center rounded-full text-[#a97570] hover:bg-[#fff1ef]"><Trash2 size={14} /></button></div>)}</div></div></div>}
  </main>;
}

function SignInPrompt() {
  return <div className="rounded-[22px] border border-[#e8ede5] bg-white px-6 py-10 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eaf2e5] text-[#608652]"><UserRound size={20} /></span><h2 className="mt-4 font-display text-lg font-extrabold text-[#344737]">Sign in to continue</h2><p className="mt-2 text-sm text-[#849084]">Your account keeps your orders, addresses and saved finds together.</p><Link to="/login" className="button-primary mt-5 inline-flex rounded-full px-6 py-3 text-xs font-bold text-white">Sign in</Link><p className="mt-4 text-xs text-[#899589]">New here? <Link to="/signup" className="font-bold text-[#5b8051] underline">Create an account</Link></p></div>;
}
function EmptyState({ icon: Icon, title, text, action }) {
  return <div className="rounded-[22px] border border-dashed border-[#d9e1d6] bg-white px-6 py-12 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eff4ec] text-[#729267]"><Icon size={21} /></span><h2 className="mt-4 font-display text-lg font-extrabold text-[#344737]">{title}</h2><p className="mt-2 text-sm text-[#849084]">{text}</p>{action && <div className="mt-5">{action}</div>}</div>;
}
function LoadingPage() { return <div className="mx-auto max-w-[1400px] px-5 py-20 text-center text-sm text-[#839083]">One moment, finding the good stuff...</div>; }
function NotFound() { return <main className="mx-auto max-w-3xl px-5 py-24 text-center"><p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#71905c]">That page took a detour</p><h1 className="mt-3 font-display text-4xl font-extrabold text-[#203629]">We couldn't find it.</h1><p className="mt-3 text-sm text-[#7c897d]">The link may have changed, but there are plenty of good finds in the shop.</p><Link to="/shop" className="button-primary mt-6 inline-flex rounded-full px-6 py-3 text-xs font-bold text-white">Back to the shop</Link></main>; }

export default App;
