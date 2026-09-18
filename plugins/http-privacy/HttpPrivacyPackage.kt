package com.tcheagro.mobile

import android.graphics.Canvas
import android.graphics.Color
import android.os.Build
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.view.WindowManager
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.common.LifecycleState
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.ViewManager
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.Event
import com.facebook.react.views.modal.ReactModalHostView
import com.facebook.react.views.view.ReactViewGroup
import com.facebook.react.views.view.ReactViewManager

/** One boundary per HTTP window, including RN Dialog windows. Events contain no business data. */
class HttpPrivacyView(private val reactContext: ThemedReactContext) : ReactViewGroup(reactContext), LifecycleEventListener {
  companion object {
    private val securedRoots = java.util.WeakHashMap<View, Boolean>()
  }
  private var generation = 0
  private var protectedContent = true
  private var resumed = false
  private var ownsSecureFlag = false

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    resumed = reactContext.lifecycleState == LifecycleState.RESUMED
    reactContext.addLifecycleEventListener(this)
    protect()
    if (hasWindowFocus() && resumed) notifyFocus(true)
  }

  override fun onDetachedFromWindow() {
    protect()
    reactContext.removeLifecycleEventListener(this)
    setLegacySecure(false)
    securedRoots.remove(rootView)
    ownsSecureFlag = false
    super.onDetachedFromWindow()
  }

  override fun onWindowFocusChanged(hasWindowFocus: Boolean) {
    if (!hasWindowFocus) protect()
    super.onWindowFocusChanged(hasWindowFocus)
    notifyFocus(hasWindowFocus && resumed)
  }

  override fun onHostPause() {
    resumed = false
    protect()
    notifyFocus(false)
  }
  override fun onHostResume() {
    resumed = true
    if (hasWindowFocus()) notifyFocus(true)
  }
  override fun onHostDestroy() { protect() }

  private fun protect() {
    generation += 1
    protectedContent = true
    importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
    setLegacySecure(true)
    invalidate()
  }

  fun release(value: Int) {
    // Late React commits from an earlier focus/Activity cycle cannot uncover this window.
    protectedContent = value != generation || !resumed || !hasWindowFocus()
    importantForAccessibility = if (protectedContent) View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS else View.IMPORTANT_FOR_ACCESSIBILITY_AUTO
    setLegacySecure(protectedContent)
    invalidate()
  }

  private fun setLegacySecure(protect: Boolean) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU || !isAttachedToWindow) return
    val root = rootView
    val activityWindow = reactContext.currentActivity?.window ?: return
    val activityRoot = activityWindow.decorView
    val window = if (root === activityRoot) activityWindow else findDialogWindow(activityRoot, root) ?: return
    val params = window.attributes
    val flag = WindowManager.LayoutParams.FLAG_SECURE
    // RN 0.85 copies the Activity flag when creating a Dialog. Own that inherited
    // temporary flag too, so a foreground modal does not keep screenshot prohibition.
    if (protect && root !== activityRoot && params.flags and flag != 0 &&
      (securedRoots[root] == true || securedRoots[activityRoot] == true)) {
      ownsSecureFlag = true
      securedRoots[root] = true
    }
    if (protect && params.flags and flag == 0) {
      ownsSecureFlag = true
      securedRoots[root] = true
      window.addFlags(flag)
    } else if (!protect && ownsSecureFlag) {
      if (root === activityRoot) rememberPendingDialogCopies(root)
      ownsSecureFlag = false
      securedRoots.remove(root)
      window.clearFlags(flag)
    } else return
    // WindowManager can replace decor LayoutParams with a copy. Window APIs keep
    // the attributes RN reads on its next Dialog creation coherent with the decor.
  }

  private fun findDialogWindow(view: View, root: View): Window? {
    if (view is ReactModalHostView) {
      val window = view.dialog?.window
      if (window?.peekDecorView() === root) return window
    }
    if (view is ViewGroup) for (index in 0 until view.childCount) {
      val child = view.getChildAt(index) ?: continue
      findDialogWindow(child, root)?.let { return it }
    }
    return null
  }

  private fun rememberPendingDialogCopies(view: View) {
    // RN 0.85 copies our Activity flag in showOrUpdate(), before Dialog attach.
    // An authorized Activity release can run in that gap. Transfer ownership
    // before clearing the Activity record, while the source flag is still ours.
    // Only newly shown RN windows qualify; existing/foreign windows are untouched.
    if (view is ReactModalHostView) {
      val window = view.dialog?.takeIf { it.isShowing }?.window
      val decor = window?.peekDecorView()
      if (decor != null && !decor.isAttachedToWindow &&
        window.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE != 0) {
        securedRoots[decor] = true
      }
    }
    if (view is ViewGroup) for (index in 0 until view.childCount) {
      view.getChildAt(index)?.let { rememberPendingDialogCopies(it) }
    }
  }

  private fun notifyFocus(focused: Boolean) {
    if (id == View.NO_ID || !isAttachedToWindow) return
    val payload = Arguments.createMap().apply {
      putInt("generation", generation)
      putBoolean("focused", focused)
    }
    val event = object : Event<Nothing>(UIManagerHelper.getSurfaceId(reactContext), id) {
      override fun getEventName() = "topPrivacyFocus"
      override fun canCoalesce() = false
      override fun getEventData() = payload
    }
    UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)?.dispatchEvent(event)
  }
  override fun dispatchDraw(canvas: Canvas) {
    if (protectedContent) canvas.drawColor(Color.rgb(27, 67, 40)) else super.dispatchDraw(canvas)
  }
  override fun onInterceptTouchEvent(event: MotionEvent): Boolean = protectedContent || super.onInterceptTouchEvent(event)
  override fun onTouchEvent(event: MotionEvent): Boolean = protectedContent || super.onTouchEvent(event)
}

class HttpPrivacyManager : ReactViewManager() {
  override fun getName() = "HttpPrivacyView"
  override fun createViewInstance(context: ThemedReactContext): ReactViewGroup = HttpPrivacyView(context)
  @ReactProp(name = "releasedGeneration", defaultInt = -1)
  fun setReleasedGeneration(view: ReactViewGroup, value: Int) { (view as HttpPrivacyView).release(value) }
  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> =
    (super.getExportedCustomDirectEventTypeConstants() ?: mutableMapOf()).apply {
      put("topPrivacyFocus", mapOf("registrationName" to "onPrivacyFocus"))
    }
}
class HttpPrivacyPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = emptyList()
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = listOf(HttpPrivacyManager())
}
