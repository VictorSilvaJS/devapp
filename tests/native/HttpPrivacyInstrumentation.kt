package com.tcheagro.mobile

import android.app.Activity
import android.app.Instrumentation
import android.content.Intent
import android.os.Bundle
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.view.WindowManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.views.modal.ReactModalHostView

/** Instrumentation-only: real RN Dialogs, real HttpPrivacyView and Android windows.
 * Authorization is supplied directly to the native prop under test; the separate
 * app smoke verifies HTTP authorization. No app data or credentials are accessed.
 */
class HttpPrivacyInstrumentation : Instrumentation() {
  private val cases = mutableListOf<String>()
  private lateinit var activity: Activity
  private lateinit var rootBoundary: HttpPrivacyView
  private lateinit var container: ViewGroup
  private var host: ReactModalHostView? = null
  private val flag = WindowManager.LayoutParams.FLAG_SECURE

  override fun onCreate(arguments: Bundle?) { super.onCreate(arguments); start() }

  private fun main(action: () -> Unit) {
    var failure: Throwable? = null
    runOnMainSync { try { action() } catch (t: Throwable) { failure = t } }
    failure?.let { throw it }
  }
  private fun until(message: String, condition: () -> Boolean) {
    val deadline = SystemClock.uptimeMillis() + 90000
    while (SystemClock.uptimeMillis() < deadline) {
      var ready = false
      main { ready = condition() }
      if (ready) return
      SystemClock.sleep(50)
    }
    error("Timed out: $message")
  }
  private fun boundary(view: View): HttpPrivacyView? {
    if (view is HttpPrivacyView) return view
    if (view is ViewGroup) for (i in 0 until view.childCount) {
      view.getChildAt(i)?.let { boundary(it)?.let { found -> return found } }
    }
    return null
  }
  private fun generation(view: HttpPrivacyView): Int =
    HttpPrivacyView::class.java.getDeclaredField("generation").apply { isAccessible = true }.getInt(view)

  private fun secure(window: Window, expected: Boolean, label: String) {
    check((window.attributes.flags and flag != 0) == expected) { "$label: Window.attributes secure != $expected" }
    val params = window.decorView.layoutParams as WindowManager.LayoutParams
    check((params.flags and flag != 0) == expected) { "$label: Decor LayoutParams secure != $expected" }
  }
  private fun open(inheritDuringCreation: Boolean = false, foreignDialog: Boolean = false): Pair<HttpPrivacyView, Window> {
    lateinit var view: HttpPrivacyView
    lateinit var window: Window
    main {
      // Replay the creation/attach handoff: RN copies the Activity flag, then
      // an already authorized Activity release arrives before Dialog attach.
      // Both flags and the subsequent Android focus transfer are real.
      if (inheritDuringCreation) rootBoundary.onWindowFocusChanged(false)
      val context = rootBoundary.context as ThemedReactContext
      val modal = ReactModalHostView(context)
      view = HttpPrivacyView(context) // NO_ID: no artificial JS events or authorization service.
      modal.addView(view, 0)
      container.addView(modal)
      host = modal
      modal.showOrUpdate()
      window = checkNotNull(modal.dialog?.window)
      if (foreignDialog) window.addFlags(flag)
      if (inheritDuringCreation) {
        check(window.attributes.flags and flag != 0) { "RN did not inherit the Activity flag" }
        rootBoundary.release(generation(rootBoundary))
      }
    }
    until("new Dialog focus") { view.isAttachedToWindow && view.hasWindowFocus() }
    return view to window
  }
  private fun close() {
    main { host?.let { it.onDropInstance(); container.removeView(it) }; host = null }
    until("root focus after discard") { rootBoundary.hasWindowFocus() }
  }

  override fun onStart() {
    val result = Bundle()
    try {
      activity = startActivitySync(Intent(targetContext, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      until("mounted HTTP boundary") { boundary(activity.window.decorView)?.also { rootBoundary = it } != null }
      main { container = activity.findViewById(android.R.id.content) }
      until("root focus") { rootBoundary.hasWindowFocus() }
      main { rootBoundary.release(generation(rootBoundary)) }
      main {
        // WindowManager may replace the decor's LayoutParams with a copy.
        // Updating only that copy must not leave Window.attributes secure for
        // RN to inherit on the next creation (observed after SystemUI capture).
        rootBoundary.onWindowFocusChanged(false)
        val copied = WindowManager.LayoutParams().apply { copyFrom(activity.window.attributes) }
        activity.windowManager.updateViewLayout(activity.window.decorView, copied)
        rootBoundary.release(generation(rootBoundary))
        secure(activity.window, false, "Activity attributes after LayoutParams copy")
        cases += "activity-attributes-after-params-copy"
      }
      var discarded: HttpPrivacyView? = null
      var discardedGeneration = -1
      repeat(3) { index ->
        val (view, window) = open(inheritDuringCreation = true)
        main {
          secure(activity.window, true, "lower Activity before release")
          val current = generation(view)
          view.release(current)
          secure(window, false, "first release ${index + 1}")
          secure(activity.window, true, "lower Activity after release")
          cases += "first-release-and-lower-${index + 1}"
          view.onHostPause()
          secure(window, true, "pending after pause")
          val copied = WindowManager.LayoutParams().apply { copyFrom(window.attributes) }
          window.windowManager.updateViewLayout(window.decorView, copied)
          view.release(current)
          secure(window, true, "old generation while paused")
          view.onHostResume()
          view.release(current)
          secure(window, true, "old generation after resume")
          view.release(generation(view))
          secure(window, false, "current generation")
          cases += "stale-generation-${index + 1}"
          discarded?.release(discardedGeneration)
          secure(window, false, "discarded instance cannot change new Dialog")
          secure(activity.window, true, "discarded instance cannot release lower Activity")
          discarded = view; discardedGeneration = current
        }
        close()
        main {
          check(!view.isAttachedToWindow) { "Dialog boundary still attached" }
          val owner = HttpPrivacyView::class.java.getDeclaredField("ownsSecureFlag").apply { isAccessible = true }
          check(!owner.getBoolean(view)) { "Discarded boundary retains flag ownership" }
          val roots = HttpPrivacyView::class.java.getDeclaredField("securedRoots").apply { isAccessible = true }.get(null) as Map<*, *>
          check(!roots.containsKey(window.decorView)) { "Discarded window remains registered" }
          rootBoundary.release(generation(rootBoundary))
          secure(activity.window, false, "authorized root after discard")
          cases += "discard-and-root-${index + 1}"
        }
      }
      val (foreignDialogView, foreignDialogWindow) = open(foreignDialog = true)
      main {
        foreignDialogView.release(generation(foreignDialogView))
        secure(foreignDialogWindow, true, "foreign Dialog flag")
      }
      close()
      main {
        rootBoundary.release(generation(rootBoundary))
        secure(activity.window, false, "root after foreign Dialog discard")
        cases += "foreign-dialog-flag-preserved"
      }
      // A flag owned by another mechanism must survive release in both windows.
      main { activity.window.addFlags(flag) }
      val (foreignView, foreignWindow) = open()
      main {
        foreignView.release(generation(foreignView))
        secure(foreignWindow, true, "foreign inherited flag")
        secure(activity.window, true, "foreign Activity flag")
      }
      close()
      main {
        rootBoundary.release(generation(rootBoundary))
        secure(activity.window, true, "foreign root flag after discard")
        activity.window.clearFlags(flag) // Only the foreign flag introduced by this test.
        cases += "foreign-flag-preserved"
      }
      result.putString("f01.cases", cases.joinToString(","))
      result.putInt("f01.passed", cases.size)
      result.putInt("f01.failed", 0)
      finish(Activity.RESULT_OK, result)
    } catch (t: Throwable) {
      result.putString("f01.failure", t.toString())
      result.putString("f01.cases", cases.joinToString(","))
      result.putInt("f01.failed", 1)
      try { main { host?.onDropInstance() } } catch (_: Throwable) { }
      finish(Activity.RESULT_CANCELED, result)
    }
  }
}
