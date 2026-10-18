"""
MiMo-V2.5-TTS Web UI — Pydantic 请求/响应模型
"""

from pydantic import BaseModel, Field, model_validator
from typing import Literal, Optional


class DirectorConfig(BaseModel):
    """导演模式配置"""
    character: str = Field("", description="角色描述")
    scene: str = Field("", description="场景描述")
    direction: str = Field("", description="演绎指导")


class ChatMessage(BaseModel):
    """代码模式 — 单条消息（原样透传给 MiMo API）"""
    role: Literal["user", "assistant", "system"] = Field(..., description="消息角色")
    content: str = Field(..., min_length=1, description="消息内容")


class PresetRequest(BaseModel):
    """预置音色合成请求"""
    voice: str = Field("mimo_default", description="音色 ID")
    text: Optional[str] = Field(None, min_length=1, description="合成文本（常规模式）")
    messages: Optional[list[ChatMessage]] = Field(
        None, min_length=1, description="自定义消息列表（代码模式，提供时优先生效）"
    )
    style_prompt: Optional[str] = Field(None, description="自然语言风格控制")
    audio_tags: Optional[str] = Field(None, description="音频标签前缀")
    director: Optional[DirectorConfig] = Field(None, description="导演模式配置")
    singing: bool = Field(False, description="唱歌模式")
    stream: bool = Field(False, description="是否流式")

    @model_validator(mode="after")
    def _require_text_or_messages(self):
        """常规模式用 text，代码模式用 messages，二者必居其一"""
        if not self.messages and not self.text:
            raise ValueError("text 与 messages 必须至少提供一项")
        return self


class VoiceDesignRequest(BaseModel):
    """音色设计合成请求"""
    voice_description: str = Field(..., min_length=1, description="音色描述")
    text: str = Field(..., min_length=1, description="合成文本")
    audio_tags: Optional[str] = Field(None, description="音频标签前缀")
    stream: bool = Field(False, description="是否流式")


class VoiceCloneRequest(BaseModel):
    """音色复刻合成请求"""
    audio_base64: str = Field(..., min_length=1, description="音频样本 Base64")
    mime_type: str = Field(..., description="MIME 类型")
    text: str = Field(..., min_length=1, description="合成文本")
    audio_tags: Optional[str] = Field(None, description="音频标签前缀")
    stream: bool = Field(False, description="是否流式")


class ConnectionTestResponse(BaseModel):
    """连接测试响应"""
    success: bool
    message: str


class SynthesisResponse(BaseModel):
    """合成响应（非流式时用于错误返回）"""
    success: bool
    message: str
    duration: Optional[float] = None


# ==================== 批量合成 ====================

class BatchPresetItem(BaseModel):
    """批量合成中的单条文本"""
    text: str = Field(..., min_length=1, description="合成文本")


class BatchPresetRequest(BaseModel):
    """批量预置音色合成请求"""
    voice: str = Field("mimo_default", description="音色 ID")
    texts: list[BatchPresetItem] = Field(..., min_length=1, max_length=50, description="文本列表")
    style_prompt: Optional[str] = Field(None, description="自然语言风格控制")
    audio_tags: Optional[str] = Field(None, description="音频标签前缀")
    director: Optional[DirectorConfig] = Field(None, description="导演模式配置")
    singing: bool = Field(False, description="唱歌模式")


class BatchVoiceDesignRequest(BaseModel):
    """批量音色设计合成请求"""
    voice_description: str = Field(..., min_length=1, description="音色描述")
    texts: list[BatchPresetItem] = Field(..., min_length=1, max_length=50, description="文本列表")
    audio_tags: Optional[str] = Field(None, description="音频标签前缀")


class BatchVoiceCloneRequest(BaseModel):
    """批量音色复刻合成请求"""
    audio_base64: str = Field(..., min_length=1, description="音频样本 Base64")
    mime_type: str = Field(..., description="MIME 类型")
    texts: list[BatchPresetItem] = Field(..., min_length=1, max_length=50, description="文本列表")
    audio_tags: Optional[str] = Field(None, description="音频标签前缀")


class BatchResultItem(BaseModel):
    """批量合成单条结果"""
    index: int
    text: str
    success: bool
    audio_base64: Optional[str] = None
    duration: Optional[float] = None
    error: Optional[str] = None


class BatchResponse(BaseModel):
    """批量合成响应"""
    total: int
    completed: int
    results: list[BatchResultItem]
