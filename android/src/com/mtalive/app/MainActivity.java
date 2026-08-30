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

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * MTA Live — full-screen WebView wrapper around the bundled static site.
 *
 * The site is served to the WebView from a tiny loopback HTTP server embedded
 * in this activity (plain java.net.ServerSocket — com.sun.net.httpserver is a
 * desktop-JDK package that does NOT exist in the Android runtime, which is why
 * the earlier attempt crashed with NoClassDefFoundError on launch).
 *
 * Loading via http://127.0.0.1:<port>/ (instead of file:///android_asset/...)
 * makes the WebView treat the page as a normal web origin, so ES modules,
 * <script type="module">, fetch() and CORS behave exactly like in a regular
 * browser. This fixes the black screen on Android 9+ devices.
 */
public class MainActivity extends Activity {
    private static final int PORT = 8123;
    private static final String START_URL = "http://127.0.0.1:8123/index.html";

    private WebView webView;
    private ServerSocket serverSocket;
    private ExecutorService serverExecutor;
    private Thread acceptThread;

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

        // MTA GTFS-RT feeds are fetched client-side over HTTPS; allow the
        // WebView to hit them directly.
        webView.setWebViewClient(new WebViewClient());

        startAssetServer();

        if (savedInstanceState == null) {
            webView.loadUrl(START_URL);
        }
    }

    /** Serve bundled web assets over loopback HTTP (plain ServerSocket). */
    private void startAssetServer() {
        try {
            serverSocket = new ServerSocket(PORT, 64, InetAddress.getByName("127.0.0.1"));
            serverExecutor = Executors.newFixedThreadPool(4);
            final AssetManager assets = getAssets();
            acceptThread = new Thread(() -> {
                while (!Thread.currentThread().isInterrupted()
                        && serverSocket != null && !serverSocket.isClosed()) {
                    try {
                        final Socket socket = serverSocket.accept();
                        serverExecutor.execute(() -> handleConnection(socket, assets));
                    } catch (IOException e) {
                        // Socket closed during shutdown — exit quietly.
                        return;
                    }
                }
            }, "asset-server-accept");
            acceptThread.setDaemon(true);
            acceptThread.start();
        } catch (IOException e) {
            // Loopback server failed to bind — fall back to file:// assets so
            // the app still renders something rather than a black screen.
            webView.loadUrl("file:///android_asset/index.html");
        }
    }

    /** Handle a single loopback HTTP connection. */
    private static void handleConnection(Socket socket, AssetManager assets) {
        try (Socket s = socket) {
            s.setSoTimeout(5000);
            BufferedReader reader =
                    new BufferedReader(new InputStreamReader(s.getInputStream(), "UTF-8"));

            String requestLine = reader.readLine();
            if (requestLine == null || !requestLine.startsWith("GET")) {
                return; // HEAD/POST etc. are not needed for the static site
            }
            // Drain the remaining request headers until the blank line.
            String line;
            while ((line = reader.readLine()) != null && !line.isEmpty()) {
                // skip header lines
            }

            String rawPath = requestLine.split(" ")[1];
            String path = URLDecoder.decode(rawPath, "UTF-8");
            if (path.equals("/") || !path.contains(".")) {
                path = "/index.html";
            }
            path = path.substring(1); // strip leading slash for asset lookup
            // Normalize: strip "./" segments; reject any "..".
            path = path.replace("./", "");
            if (path.contains("..")) {
                writeResponse(s, 400, "text/plain", "Bad request".getBytes("UTF-8"));
                return;
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
                in = assets.open("www/" + path);
                byte[] body = readAll(in);
                writeResponse(s, 200, mime, body);
            } catch (IOException e) {
                writeResponse(s, 404, "text/plain", "Not found".getBytes("UTF-8"));
            } finally {
                if (in != null) {
                    try { in.close(); } catch (IOException ignored) {}
                }
            }
        } catch (Exception ignored) {
            // Never let a malformed request kill the server thread.
        }
    }

    private static void writeResponse(Socket socket, int status, String mime, byte[] body)
            throws IOException {
        OutputStream out = socket.getOutputStream();
        String statusText = status == 200 ? "OK" : status == 404 ? "Not Found" : "Bad Request";
        String headers = "HTTP/1.1 " + status + " " + statusText + "\r\n"
                + "Content-Type: " + mime + "\r\n"
                + "Content-Length: " + body.length + "\r\n"
                + "Cache-Control: max-age=3600\r\n"
                + "Connection: close\r\n"
                + "\r\n";
        out.write(headers.getBytes("UTF-8"));
        out.write(body);
        out.flush();
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
        try {
            if (serverSocket != null && !serverSocket.isClosed()) {
                serverSocket.close();
            }
        } catch (IOException ignored) {}
        if (acceptThread != null) {
            acceptThread.interrupt();
            acceptThread = null;
        }
        if (serverExecutor != null) {
            serverExecutor.shutdownNow();
            serverExecutor = null;
        }
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
