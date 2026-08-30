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
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * MTA Live — full-screen WebView wrapper around the bundled static site.
 *
 * The site is served via shouldInterceptRequest on a virtual HTTPS origin
 * (https://appassets.mtalive.local/). This is the WebViewAssetLoader pattern
 * without the androidx dependency: the WebView sees a normal secure origin, so
 * ES modules (<script type="module">), fetch() and CORS all behave exactly
 * like in a regular browser. Unlike a file:// URL this cannot produce the
 * black screen on Android 9-10 devices, and unlike a loopback server it needs
 * no socket, no port, and no cleartext policy exceptions — it works on any
 * WebView, including the older ones shipped on LineageOS / Fire OS.
 */
public class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.mtalive.local";
    private static final String START_URL = ORIGIN + "/index.html";
    private static final String ASSET_PREFIX = "appassets.mtalive.local";

    private WebView webView;

    private static final String MIME =
            ".css=text/css;.js=text/javascript;.mjs=text/javascript;.html=text/html"
            + ";.json=application/json;.svg=image/svg+xml;.png=image/png;.jpg=image/jpeg"
            + ";.jpeg=image/jpeg;.webp=image/webp;.gif=image/gif;.ico=image/x-icon"
            + ";.woff=font/woff;.woff2=font/woff2;.ttf=font/ttf;.map=application/json"
            + ";.txt=text/plain;.wasm=application/wasm";

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

        // Serve the bundled site on the virtual HTTPS origin; let all other
        // requests (the MTA GTFS-RT feeds over HTTPS) pass through untouched.
        final AssetManager assets = getAssets();
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (request == null || !ASSET_PREFIX.equals(request.getUrl().getHost())) {
                    return null;
                }
                return serveAsset(assets, request.getUrl().getPath());
            }
        });

        if (savedInstanceState == null) {
            webView.loadUrl(START_URL);
        }
    }

    /** Serve one bundled asset as a WebResourceResponse (404 empty otherwise). */
    private static WebResourceResponse serveAsset(AssetManager assets, String rawPath) {
        String path = (rawPath == null || rawPath.equals("/") || !rawPath.contains("."))
                ? "/index.html" : rawPath;
        path = path.substring(1); // strip leading slash for asset lookup
        if (path.contains("..")) {
            return notFound();
        }

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
            in = assets.open("assets/" + path);
            byte[] body = readAll(in);
            Map<String, String> headers = new HashMap<>();
            headers.put("Access-Control-Allow-Origin", ORIGIN);
            headers.put("Cache-Control", "max-age=3600");
            return new WebResourceResponse(mime, "UTF-8", 200, "OK", headers,
                    new ByteArrayInputStream(body));
        } catch (IOException e) {
            return notFound();
        } finally {
            if (in != null) {
                try { in.close(); } catch (IOException ignored) {}
            }
        }
    }

    private static WebResourceResponse notFound() {
        Map<String, String> headers = new HashMap<>();
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", headers,
                new ByteArrayInputStream(new byte[0]));
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
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
