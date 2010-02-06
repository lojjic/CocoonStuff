package org.apache.cocoon.jspacker;

import org.apache.cocoon.reading.ResourceReader;
import org.apache.cocoon.environment.SourceResolver;
import org.apache.cocoon.ProcessingException;
import org.apache.avalon.framework.parameters.Parameters;
import org.apache.commons.io.IOUtils;
import org.apache.excalibur.source.Source;
import org.xml.sax.SAXException;
import org.mozilla.javascript.Scriptable;
import org.mozilla.javascript.Context;
import org.mozilla.javascript.Function;

import java.util.Map;
import java.io.*;

/**
 * A specialized {@link org.apache.cocoon.reading.Reader} for JavaScript
 * files which compresses them using Dean Edwards' Packer algorithm.
 * See http://dean.edwards.name/packer/ for details.
 * <p>
 * Parameters:
 * <dl>
 *   <dt>&lt;parameter name="shrink-variables" value="true|false" /></dt>
 *   <dd>(Boolean, optional, false by default) If set to true, causes
 *       the packer script to shrink the names of all local variables.</dd>
 *   <dt>&lt;parameter name="base62-encode" value="true|false" /></dt>
 *   <dd>(Boolean, optional, false by default) If set to true, causes
 *       the packer script to encode the shrunken source with a base62
 *       encoding algorithm.</dd>
 *   <dt>&lt;parameter name="comment" value="..." /></dt>
 *   <dd>(Optional) Allows a custom comment to be embedded at the top of the
 *       packed JavaScript file.</dd>
 *   <dt>&lt;parameter name="original-script-uri" value="..." /></dt>
 *   <dd>(Optional) If you choose to make the original, unpacked source code
 *       of your JavaScript file available at another URI, you can
 *       set the original-script-uri parameter to have that URI
 *       embedded in a comment in the packed file.</dd>
 * </dl>
 */
public class JSPackerReader extends ResourceReader {

    protected static String[] packerSources = {
        "resource://org/apache/cocoon/jspacker/base2-jsb.js",
        "resource://org/apache/cocoon/jspacker/Words.js",
        "resource://org/apache/cocoon/jspacker/Packer.js"
    };

    private boolean base62Encode;
    private boolean shrinkVariables;
    private String comment;
    private String origScriptURI;

    /**
     * Setup the reader.
     */
    public void setup(SourceResolver resolver, Map objectModel, String src, Parameters par)
            throws ProcessingException, SAXException, IOException {

        this.base62Encode = par.getParameterAsBoolean("base62-encode", false);
        this.shrinkVariables = par.getParameterAsBoolean("shrink-variables", false);
        this.origScriptURI = par.getParameter("original-script-uri", null);
        this.comment = par.getParameter("comment", null);

        super.setup(resolver, objectModel, src, par);
    }

    /**
     * Process the JavaScript input stream.
     */
    protected void processStream(InputStream unpackedInputStream) throws IOException, ProcessingException {
        // Run the incoming stream through the packer:
        String packedScript;
        try {
            packedScript = pack(IOUtils.toString(unpackedInputStream));
        }
        finally {
            IOUtils.closeQuietly(unpackedInputStream);
        }

        // Send packed script to the client:
        super.processStream(IOUtils.toInputStream(packedScript));
    }

    /**
     * Load the packer source scripts into the JS scope
     */
    protected void loadPackerScript(Scriptable scope) throws ProcessingException {
        for(int i=0; i<packerSources.length; i++) {
            Source source = null;
            InputStream inputStream = null;
            Reader reader = null;
            try {
                source = resolver.resolveURI(packerSources[i]);
                inputStream = source.getInputStream();
                reader = new InputStreamReader(inputStream);
                Context.getCurrentContext().evaluateReader(scope, reader, packerSources[i], 1, null);
            }
            catch (IOException e) {
                throw new ProcessingException("Error loading JavaScript packer script.", e);
            }
            finally {
                resolver.release(source);
                IOUtils.closeQuietly(reader);
                IOUtils.closeQuietly(inputStream);
            }
        }
    }

    /**
     * Pack the given JavaScript source string
     * @param script - the original unpacked source code
     * @return the packed script
     * @throws ProcessingException
     */
    protected String pack(String script) throws ProcessingException {
        // Enter a JS context:
        Context jsContext = Context.enter();
        try {
            // Create the JS scope:
            Scriptable scope = jsContext.initStandardObjects(null);

            // Load the packer tool script files:
            loadPackerScript(scope);

            // Execute the packer:
            String functionSrc = "function(script,shrink,encode){var packer=new Packer; return packer.pack(script,shrink,encode);}";
            Function function = jsContext.compileFunction(scope, functionSrc, "", 0, null);
            Object functionArgs[] = {script, Boolean.valueOf(shrinkVariables), Boolean.valueOf(base62Encode)};
            return (String)function.call(jsContext, scope, scope, functionArgs);
        }
        finally {
            Context.exit();
        }
    }

    /**
     * Build a comment to insert at the top of the packed script
     */
    protected String buildComment() {
        StringBuffer buf = new StringBuffer("/*\nScript compressed with Packer by Dean Edwards (http://dean.edwards.name/packer/)\n");
        if(origScriptURI != null) {
            buf.append("Original script source available at ");
            buf.append(origScriptURI);
            buf.append("\n");
        }
        if(comment != null) {
            buf.append("\n");
            buf.append(comment);
            buf.append("\n");
        }
        buf.append("*/\n");
        return buf.toString();
    }


    /**
     * Include the shrink-variables and base62-encode parameters in the cache key
     */
    public Serializable getKey() {
        return super.getKey() + ":shrinkVars=" + shrinkVariables + ":base62encode=" + base62Encode;
    }
}
