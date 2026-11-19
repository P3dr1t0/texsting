/*
 * Reemplazo de libandroid-complex-math.so (Termux) con alineación de 16 KB, que exige Google Play.
 * De esa librería solo se usa cpow (la usa luahbtex); kpathsea y texlua solo la tienen enlazada.
 * cpow(z, w) = exp(w · log z), con las funciones reales de libm (están en todas las versiones de Android).
 */
double exp(double), log(double), atan2(double, double), hypot(double, double), sin(double), cos(double);

double _Complex cpow(double _Complex z, double _Complex w) {
    double x = __builtin_creal(z), y = __builtin_cimag(z), c = __builtin_creal(w), d = __builtin_cimag(w);
    if (x == 0 && y == 0) {
        if (c == 0 && d == 0) return __builtin_complex(1.0, 0.0);
        return __builtin_complex(0.0, 0.0);
    }
    double lr = log(hypot(x, y)), th = atan2(y, x);
    double a = c * lr - d * th, b = d * lr + c * th, r = exp(a);
    return __builtin_complex(r * cos(b), r * sin(b));
}
