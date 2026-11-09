package com.nusantara.exporthub

import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView

// Replace with the deployed HTTPS website URL after GitHub Pages is enabled.
private const val WEB_APP_URL = "https://YOUR-GITHUB-PAGES-URL/"

class MainActivity : ComponentActivity() {
 override fun onCreate(savedInstanceState: Bundle?) {
  super.onCreate(savedInstanceState)
  setContent {
   MaterialTheme {
    Surface(Modifier.fillMaxSize()) {
     AndroidView(
      modifier = Modifier.fillMaxSize(),
      factory = { context ->
       WebView(context).apply {
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        webViewClient = WebViewClient()
        loadUrl(WEB_APP_URL)
       }
      }
     )
    }
   }
  }
 }
}