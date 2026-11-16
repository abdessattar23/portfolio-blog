---
slug: byte-buddy-changing-a-java-method
title: "Byte Buddy: Changing a Java Method Without Editing It"
description: "A focused Byte Buddy experiment: add timing to an existing Java
  method through bytecode transformation, without changing application source."
excerpt: I wanted to time a Java method without touching it. Here's the Byte
  Buddy experiment, from matching the method to seeing the changed behavior.
publishedAt: 2026-11-16
updatedAt: 2026-11-16
topics:
  - Java
  - Byte Buddy
  - JVM
template: deep-dive
draft: false
accent: "#67493a"
---

# Byte Buddy: Changing a Java Method Without Editing It

I wanted to do something simple: add timing to a Java method **without touching the method or changing its callers**.

Normally, I'd put a timer inside the method, wrap the object in a proxy, or add an interceptor at the framework level. All reasonable choices. But they leave one question unanswered: *can I change the behavior of the class itself as the JVM loads it?*

That's the experiment here, using **Byte Buddy**.

By the end, the same `Greeter` class will print an extra line when a method runs. Its Java source won't contain the extra line, and we won't rebuild a modified version of the application.

## Start with an ordinary method

**`Greeter.java`**, the class we want to change:

~~~java
package example.demo;

public class Greeter {
    public String greet(String name) throws InterruptedException {
        Thread.sleep(25);
        return "Hello, " + name + "!";
    }
}
~~~

**`Main.java`**, the ordinary caller:

~~~java
package example.demo;

public class Main {
    public static void main(String[] args) throws Exception {
        System.out.println(new Greeter().greet("Java"));
    }
}
~~~

Running it normally prints just:

~~~text
Hello, Java!
~~~

The `Thread.sleep(25)` is there to give us a measurable delay. It has no special meaning.

What I want to see instead is:

~~~text
[Byte Buddy] greet took 25.4 ms
Hello, Java!
~~~

The exact elapsed time will vary. The interesting part is the **extra behavior**, not the number.

## Byte Buddy works with bytecode, not source files

The Java compiler turns `Greeter.java` into `Greeter.class`. The JVM loads that class file's bytes and defines a class from them.

Byte Buddy can generate and modify class files without us writing JVM instructions by hand. For this experiment, we'll use it to transform `Greeter` **before the JVM defines the class**.

:::artifact{id="java-agent-load-time-path"}

We're not opening `Greeter.java`, adding a logging statement, and compiling it again.

We're supplying modified class-file bytes during loading. The original class file in the application JAR stays as it was.

There's an important distinction here: Byte Buddy also supports generating subclasses and new classes at runtime. But in **this** experiment, we're transforming a class on its loading path. That's why we'll use a small startup agent to install Byte Buddy's transformation rule.

## The extra instructions: Byte Buddy Advice

Byte Buddy has an API called `Advice` that describes code to insert at the beginning or end of a method.

**`TimingAdvice.java`** contains the timing logic:

~~~java
package example.agent;

import net.bytebuddy.asm.Advice;

public class TimingAdvice {

    @Advice.OnMethodEnter
    static long enter() {
        return System.nanoTime();
    }

    @Advice.OnMethodExit(onThrowable = Throwable.class)
    static void exit(
            @Advice.Enter long started,
            @Advice.Origin("#m") String methodName) {

        double millis =
                (System.nanoTime() - started) / 1_000_000.0;

        System.out.printf(
                "[Byte Buddy] %s took %.3f ms%n",
                methodName, millis);
    }
}
~~~

The annotations do most of the interesting work.

`@Advice.OnMethodEnter` says the first method should run at the entry point of the method we select. It returns a timestamp.

`@Advice.Enter` makes that timestamp available to the exit advice. The method we're instrumenting doesn't need a new parameter or field to store it.

`@Advice.OnMethodExit(onThrowable = Throwable.class)` runs when the method exits, including an exceptional exit. `@Advice.Origin("#m")` supplies the name of the instrumented method.

For this example, Byte Buddy **inlines the advice instructions** into the target method's bytecode.

Conceptually, we're turning this:

~~~java
return "Hello, " + name + "!";
~~~

into a method that starts a timer, executes its original body, and reports the elapsed time as it leaves.

:::artifact{id="javaagent-timing-before-after"}

The diagram is deliberately pseudocode. It illustrates the behavior, not an exact disassembly.

One detail I like about `Advice` is that it forces you to think about the actual method boundary. We said *time the method*, not *time some operation that might continue asynchronously after the method returns*. Those aren't necessarily the same thing.

## The matcher decides where the advice goes

Our advice doesn't know about `Greeter`. It describes *what* to add, not *where* to add it.

For the second part, Byte Buddy provides `AgentBuilder`. This is **`TimingAgent.java`**:

~~~java
package example.agent;

import java.lang.instrument.Instrumentation;
import net.bytebuddy.agent.builder.AgentBuilder;
import net.bytebuddy.asm.Advice;

import static net.bytebuddy.matcher.ElementMatchers.named;
import static net.bytebuddy.matcher.ElementMatchers.takesArguments;

public class TimingAgent {

    public static void premain(
            String args,
            Instrumentation instrumentation) {

        new AgentBuilder.Default()
            .type(named("example.demo.Greeter"))
            .transform((builder, type, loader, module, domain) ->
                builder.visit(
                    Advice.to(TimingAdvice.class)
                        .on(named("greet").and(takesArguments(1)))
                )
            )
            .installOn(instrumentation);
    }
}
~~~

Read the middle of that chain closely.

`.type(named(...))` matches the class.

`.on(named("greet").and(takesArguments(1)))` matches the method.

`Advice.to(TimingAdvice.class)` describes the bytecode to add.

`.installOn(instrumentation)` registers Byte Buddy's transformer with the JVM.

The `premain` method is called when the JVM starts with a `-javaagent` option. That option is how we get our transformation installed early enough, *before* the application first loads `Greeter`.

Nothing in `Main` changes. No call to `TimingAgent` is added to `Greeter`. The rule lives outside the application code.

## Run the experiment

The project has four Java files:

~~~text
src/main/java/example/
    demo/Main.java
    demo/Greeter.java
    agent/TimingAgent.java
    agent/TimingAdvice.java
~~~

We need the Byte Buddy dependency and a JAR manifest that points to `TimingAgent` as the startup agent. The Maven Shade plugin can bundle Byte Buddy into the executable JAR and generate the two manifest entries.

The JAR needs its normal `Main-Class` and an agent `Premain-Class` in the manifest. Maven Shade can bundle Byte Buddy and create those entries. I've put the complete `pom.xml` in the appendix so it doesn't interrupt the experiment.

Build from a terminal:

~~~cmd
mvn clean package
~~~

First, run it without the agent:

~~~cmd
java -jar target\bytebuddy-demo.jar
~~~

You should see only `Hello, Java!`.

Now run **the same JAR** with the agent enabled:

~~~cmd
java -javaagent:target\bytebuddy-demo.jar -jar target\bytebuddy-demo.jar
~~~

The expected pattern is:

~~~text
[Byte Buddy] greet took 25.4 ms
Hello, Java!
~~~

These are expected results, not output I've captured from a completed local run. I checked the API and dependency version, but couldn't fetch the dependency in this environment to execute the project end to end.

## What changed, and what didn't?

The method now does extra work when the JVM executes it. But its source code didn't change, and its class file on disk wasn't rewritten.

That last part is easy to miss.

If you open the original JAR with `javap`, you'll inspect the bytes stored in the JAR, not necessarily the transformed bytes that were supplied to the JVM at class-definition time.

The timing behavior also depends on **when** the transformer was registered. Our example registers it before `Greeter` is loaded. If `Greeter` had already been defined, this simple setup wouldn't go back and patch it automatically.

And this is not equivalent to a regular Java proxy. A proxy requires callers to use the proxy object. Here, the JVM is defining a transformed version of `Greeter` itself, so the normal `new Greeter()` in `Main` remains unchanged.

There are limits, of course. Advice has a runtime cost. A broad matcher can instrument far more methods than intended. And code inserted into a class must still satisfy JVM verification and class-loader constraints.

None of those problems is solved by simply writing a clever matcher.

## The part I find interesting

We wrote one class with a normal method, one advice class describing extra behavior, and one rule telling Byte Buddy where to apply it.

No modified application source. No handwritten bytecode. No special framework.

The essential chain is small:

**Match a class. Match a method. Generate modified bytecode. Let the JVM define it.**

That's what makes Byte Buddy interesting to me. The API is readable enough that we can describe the transformation in Java, but the result changes the instructions the JVM will execute.

The next thing I'd investigate is how to **inspect the transformed class bytes** rather than just trusting the timing output. Seeing the extra instructions in the bytecode would be a more convincing proof than a log line.

For now, the useful lesson is simpler: **Byte Buddy doesn't make bytecode disappear. It gives us a much nicer way to work with it.**

## Appendix: Complete Maven configuration

For anyone running the example, here's the full `pom.xml`. It packages the four Java files and Byte Buddy into the same executable JAR.

~~~xml
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <groupId>example</groupId>
    <artifactId>bytebuddy-demo</artifactId>
    <version>1.0.0</version>

    <properties>
        <maven.compiler.release>17</maven.compiler.release>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>

    <dependencies>
        <dependency>
            <groupId>net.bytebuddy</groupId>
            <artifactId>byte-buddy</artifactId>
            <version>1.18.17</version>
        </dependency>
    </dependencies>

    <build>
        <finalName>bytebuddy-demo</finalName>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.14.1</version>
            </plugin>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-shade-plugin</artifactId>
                <version>3.6.2</version>
                <executions>
                    <execution>
                        <phase>package</phase>
                        <goals><goal>shade</goal></goals>
                        <configuration>
                            <createDependencyReducedPom>false</createDependencyReducedPom>
                            <transformers>
                                <transformer implementation="org.apache.maven.plugins.shade.resource.ManifestResourceTransformer">
                                    <manifestEntries>
                                        <Main-Class>example.demo.Main</Main-Class>
                                        <Premain-Class>example.agent.TimingAgent</Premain-Class>
                                    </manifestEntries>
                                </transformer>
                            </transformers>
                        </configuration>
                    </execution>
                </executions>
            </plugin>
        </plugins>
    </build>
</project>
~~~

## Sources

- [Byte Buddy: official tutorial](https://bytebuddy.net/)
- [Byte Buddy: class transformations and agents](https://bytebuddy.net/partial/tutorial.partial.html)
- [Java Instrumentation API](https://docs.oracle.com/en/java/javase/21/docs/api/java.instrument/java/lang/instrument/package-summary.html)
- [Byte Buddy releases](https://github.com/raphw/byte-buddy/releases)
