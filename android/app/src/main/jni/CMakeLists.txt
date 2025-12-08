cmake_minimum_required(VERSION 3.13)

# Define the library name here.
project(appmodules)

set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Include React Native default CMake for New Architecture (builds appmodules)
include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

# Whisper native integration
set(WHISPER_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../cpp/whisper")
set(WHISPER_BRIDGE_SRC "${CMAKE_CURRENT_SOURCE_DIR}/../cpp/whisper_bridge.cpp")

if(EXISTS "${WHISPER_DIR}/whisper.cpp")
  add_definitions(-DHAS_WHISPER)
  file(GLOB WHISPER_SOURCES "${WHISPER_DIR}/*.c" "${WHISPER_DIR}/*.cpp")
  add_library(whisper STATIC ${WHISPER_SOURCES})
  target_include_directories(whisper PUBLIC ${WHISPER_DIR})
endif()

add_library(whisper_bridge SHARED ${WHISPER_BRIDGE_SRC})
target_include_directories(whisper_bridge PRIVATE ${WHISPER_DIR})

find_library(log-lib log)

if(TARGET whisper)
  target_link_libraries(whisper_bridge whisper ${log-lib})
else()
  target_link_libraries(whisper_bridge ${log-lib})
endif()
