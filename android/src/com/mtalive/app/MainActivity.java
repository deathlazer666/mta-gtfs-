package com.mtalive.app;

import android.app.Activity;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.util.concurrent.Executors;

/**
 * MTA Live — full-screen WebView wrapper around the bundled static site.
 *
 * The site is served to the WebView from a tiny loopback HTTP server embedded
 * in this activity. Loading via http://127.0.0.1:<port>/ (instead of
 * file:///android_asset/...) makes the WebView treat the page as a normal web
 * origin, so ES modules, <script type="module">, fetch() and CORS behave
 * exactly like in a regular browser. This fixes the black screen on Android 9+
 * devices where file:// origins silently block module scripts.
 */
public class MainActivity extends Activity {
    private static final int PORT = 8123;
    private static final String START_URL = "http://127.0.0.1:8123/index.html";

    private WebView webView;
    private HttpServer server;

    private static final String MIME = ".css=text/css;.js=text/javascript;.mjs=text/javascript;.html=text/html;.json=application/json;.svg=image/svg+xml;.png=image/png;.jpg=image/jpeg;.jpeg=image/jpeg;.webp=image/webp;.gif=image/gif;.ico=image/x-icon;.woff=font/woff;.woff2=font/woff2;.ttf=font/ttf;.map=application/json;.txt=text/plain;.wasm=application/wasm";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Edge-to-edge dark window.
        Window window = getWindow();
        window.setStatusBarColor(Color.parseColor("#07090d"));
        window.setNavigationBarColor(Color.parseColor("#07090d"));

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);

        webView.setBackgroundColor(Color.parseColor("#07090d"));
        applyImmersiveMode();

        // MTA GTFS-RT feeds are fetched client-side over HTTPS; allow the
        // WebView to hit them directly.
        webView.setWebViewClient(new WebViewClient());

        startAssetServer();

        if (savedInstanceState == null) {
            webView.loadUrl(START_URL);
        }
    }

    /** Serve bundled web assets over loopback HTTP. */
    private void startAssetServer() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", PORT), 0);
            server.createContext("/", new AssetHandler(getAssets()));
            server.setExecutor(Executors.newSingleThreadExecutor());
            server.start();
            this.server = server;
        } catch (IOException e) {
            // Loopback server failed to bind — fall back to file:// assets so
            // the app still renders something rather than a black screen.
            webView.loadUrl("file:///android_asset/index.html");
        }
    }

    private static class AssetHandler implements HttpHandler {
        private final AssetManager assets;

        AssetHandler(AssetManager assets) {
            this.assets = assets;
        }

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String path = exchange.getRequestURI().getPath();
            if (path == null || path.equals("/") || !path.contains(".")) {
                path = "/index.html";
            }
            path = path.substring(1); // strip leading slash for asset lookup

            String mime = "application/octet-stream";
            int dot = path.lastIndexOf('.');
            if (dot >= 0) {
                String key = path.substring(dot).toLowerCase();
                int semi = MIME.indexOf(";" + key + "=");
                if (semi >= 0) {
                    int start = semi + key.length() + 2;
                    int end = MIME.indexOf(';', start);
                    mime = end >= 0 ? MIME.substring(start, end) : MIME.substring(start);
                }
            }

            InputStream in = null;
            try {
                in = assets.open("www/" + path);
                byte[] body = readAll(in);
                exchange.getResponseHeaders().set("Content-Type", mime);
                exchange.getResponseHeaders().set("Cache-Control", "max-age=3600");
                exchange.sendResponseHeaders(200, body.length);
                OutputStream out = exchange.getResponseBody();
                out.write(body);
                out.close();
            } catch (IOException e) {
                byte[] body = "Not found".getBytes("UTF-8");
                exchange.sendResponseHeaders(404, body.length);
                exchange.getResponseBody().write(body);
                exchange.close();
            } finally {
                if (in != null) {
                    try { in.close(); } catch (IOException ignored) {}
                }
            }
        }

        private static byte[] readAll(InputStream in) throws IOException {
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int n;
            while ((n = in.read(chunk)) > 0) {
                buf.write(chunk, 0, n);
            }
            return buf.toByteArray();
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyImmersiveMode();
        }
    }

    private void applyImmersiveMode() {
        View decor = getWindow().getDecorView();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = decor.getWindowInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.systemBars());
                controller.setSystemBarsBehavior(
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            decor.setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (server != null) {
            server.stop(0);
            server = null;
        }
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
