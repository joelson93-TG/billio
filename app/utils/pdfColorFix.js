// app/utils/pdfColorFix.js
// Corrige le bug "Attempting to parse an unsupported color function oklch"
// provoqué par html2canvas/html2pdf face aux couleurs générées par Tailwind v4.
//
// ══════════════════════════════════════════════════════════════════════════
// POURQUOI LES TENTATIVES PRÉCÉDENTES ÉCHOUAIENT :
// ══════════════════════════════════════════════════════════════════════════
// html2canvas capture sa propre référence interne vers `getComputedStyle`
// dès le chargement du script. Réassigner `window.getComputedStyle` (ou
// `clonedDoc.defaultView.getComputedStyle`) dans onclone ne change RIEN,
// car la librairie continue d'utiliser SA copie de la fonction, jamais
// la nôtre. De même, modifier les règles CSS ou les styles inline en amont
// ne suffit pas : html2canvas relit lui-même les valeurs calculées au
// moment du rendu, bien après notre passage dans onclone.
//
// ══════════════════════════════════════════════════════════════════════════
// LA SOLUTION ROBUSTE :
// ══════════════════════════════════════════════════════════════════════════
// On ne patche pas la fonction getComputedStyle, mais le PROTOTYPE de
// l'objet qu'elle retourne : CSSStyleDeclaration.prototype. Peu importe
// qui appelle getComputedStyle() et à quel moment, l'objet renvoyé est
// toujours une instance de CSSStyleDeclaration — en interceptant ses
// méthodes/getters au niveau du prototype, TOUS les appels sont
// automatiquement filtrés, y compris ceux faits via la référence mise en
// cache par html2canvas.
//
// Comme html2pdf clone la page dans un iframe séparé (chaque iframe a son
// propre CSSStyleDeclaration global, distinct de la page principale), on
// patche le prototype de la fenêtre du DOCUMENT CLONÉ (clonedDoc.defaultView),
// et non celui de la page principale.

const MODERN_COLOR_REGEX = /(oklch|oklab|lab|lch|color)\([^)]*\)/gi;

/**
 * Convertit une chaîne contenant oklch()/lab()/lch()/color(...) en son
 * équivalent rgb()/rgba(), via un canvas 2D qui normalise toujours sa
 * sortie quel que soit le format d'entrée fourni par le navigateur.
 */
function toRgbSafe(ctx, value) {
  if (!value || typeof value !== "string") return value;
  return value.replace(MODERN_COLOR_REGEX, (match) => {
    try {
      ctx.fillStyle = "#000000"; // reset pour éviter un cache de valeur invalide
      ctx.fillStyle = match;
      return ctx.fillStyle;
    } catch {
      return "rgb(0,0,0)";
    }
  });
}

/**
 * Recherche un descripteur de propriété en remontant la chaîne de
 * prototypes (utile car selon le navigateur, certaines propriétés
 * camelCase peuvent être définies sur un prototype intermédiaire).
 */
function findPropertyDescriptor(obj, prop) {
  let current = obj;
  while (current) {
    const descriptor = Object.getOwnPropertyDescriptor(current, prop);
    if (descriptor) return descriptor;
    current = Object.getPrototypeOf(current);
  }
  return null;
}

const CAMELCASE_COLOR_PROPS = [
  "color",
  "backgroundColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "outlineColor",
  "textDecorationColor",
  "caretColor",
  "columnRuleColor",
  "boxShadow",
  "backgroundImage",
  "fill",
  "stroke",
  "cssText",
];

/**
 * À utiliser dans l'option html2canvas.onclone de html2pdf.
 *
 * Patche CSSStyleDeclaration.prototype dans la fenêtre du document cloné
 * (l'iframe temporaire créé par html2canvas pour la capture), afin que
 * TOUTE lecture de couleur (via getPropertyValue OU accès direct à une
 * propriété camelCase) soit automatiquement nettoyée des fonctions de
 * couleur modernes non supportées (oklch, oklab, lab, lch, color()).
 *
 * Cette approche fonctionne quelle que soit la façon dont html2canvas
 * accède aux styles, car elle intercepte au niveau du PROTOTYPE partagé
 * par tous les objets CSSStyleDeclaration de cette fenêtre — impossible
 * à contourner en gardant une "vieille" référence de fonction en cache.
 *
 * Le document cloné étant une copie jetable (détruite après capture), il
 * n'est pas nécessaire de restaurer les méthodes originales.
 */
export function fixOklchColors(clonedDoc) {
  try {
    const win = clonedDoc.defaultView || clonedDoc.parentWindow;
    if (!win || !win.CSSStyleDeclaration || !win.CSSStyleDeclaration.prototype) {
      return;
    }
    const proto = win.CSSStyleDeclaration.prototype;

    // Évite un double patch si onclone est appelé plusieurs fois
    if (proto.__oklchPatched) return;
    proto.__oklchPatched = true;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function sanitize(value) {
      if (typeof value !== "string" || value.indexOf("(") === -1) return value;
      if (!MODERN_COLOR_REGEX.test(value)) return value;
      MODERN_COLOR_REGEX.lastIndex = 0;
      return toRgbSafe(ctx, value);
    }

    // ── 1) Patch de getPropertyValue ─────────────────────────────────
    // C'est la méthode la plus universelle : elle couvre aussi bien les
    // propriétés standard ("background-color") que les variables CSS
    // personnalisées de Tailwind ("--tw-shadow-color", "--tw-ring-color"...).
    const originalGetPropertyValue = proto.getPropertyValue;
    if (typeof originalGetPropertyValue === "function") {
      proto.getPropertyValue = function (prop) {
        const value = originalGetPropertyValue.call(this, prop);
        return sanitize(value);
      };
    }

    // ── 2) Patch des getters camelCase directs ───────────────────────
    // Sécurité additionnelle, au cas où du code lirait .backgroundColor,
    // .fill, .cssText, etc. sans passer par getPropertyValue.
    CAMELCASE_COLOR_PROPS.forEach((prop) => {
      const descriptor = findPropertyDescriptor(proto, prop);
      if (!descriptor || typeof descriptor.get !== "function") return;
      const originalGet = descriptor.get;
      try {
        Object.defineProperty(proto, prop, {
          configurable: true,
          enumerable: descriptor.enumerable,
          get() {
            const value = originalGet.call(this);
            return sanitize(value);
          },
          set: descriptor.set,
        });
      } catch {
        // Certaines propriétés ne sont pas reconfigurables selon le
        // navigateur : on ignore silencieusement, le filet de
        // getPropertyValue reste actif dans tous les cas.
      }
    });
  } catch (err) {
    console.warn("fixOklchColors: échec du correctif de couleurs oklch", err);
  }
}