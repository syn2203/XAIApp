cmake_minimum_required(VERSION 3.22.1)
project("whisper_bridge")

# 设置 C++ 标准
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 添加 whisper_bridge 库
add_library(
    whisper_bridge
    SHARED
    whisper_bridge.cpp
)

# 查找必要的库
find_library(
    log-lib
    log
)

# 链接库
target_link_libraries(
    whisper_bridge
    ${log-lib}
)

# 包含目录
target_include_directories(
    whisper_bridge
    PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
)
