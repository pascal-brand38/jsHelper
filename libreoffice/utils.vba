' Copyright (c) Pascal Brand
' MIT License

OPTION EXPLICIT

' Lock and Unlock display
' To be run when an excel sheet is updated several times, so that display is not
' run too early.
' Speed-up things
Sub lockLibreOffice(isLock as Boolean)
  If isLock Then
    ThisComponent.LockControllers
    ThisComponent.addActionLock()
    ThisComponent.EnableAutomaticCalculation(False)
  Else
    ThisComponent.EnableAutomaticCalculation(True)
    ThisComponent.removeActionLock()
    ThisComponent.UnlockControllers
  End If
End Sub


' Timing display
' Typical usage is
'
'    stepTimeInit(0)
'    MyCode()
'    stepTime("My Code Step: ", 0)
'    OtherCode()
'    stepTime("My Code Step: ", 0)
'    MsgBox(stepTimeMsg(0))

Private _stepMsg as String

Sub stepTimeInit(index as Long)
  _stepTime = GetSystemTicks
  _stepMsg = ""
End Sub

Sub stepTime(txt as String, index as Long)
  Dim t as Long: t =  GetSystemTicks - _stepTime
  _stepMsg = _stepMsg + txt + t + "ms" + chr(13)
  _stepTime = GetSystemTicks
End Sub

Function stepTimeMsg(index as Long)
  stepTimeMsg = _stepMsg
End Function
